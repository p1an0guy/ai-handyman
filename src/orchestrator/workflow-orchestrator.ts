import { v4 as uuidv4 } from 'uuid';
import {
  SessionState,
  SessionLifecycleState,
  StepWorkflowState,
  Step,
  DiagramEntry,
  Warning,
  BlockedState,
  DerivedState,
  StepTransitionProposal,
} from '../models/index.js';
import { validateTransition, derivedState } from './state-machine.js';
import type { SessionStore, ManualStore, ImageStore } from '../storage/interfaces.js';
import type { OrchestratorEventLogger } from './event-logger.js';
import type { ModelOrchestrationLayer, StructuredAnswer } from '../ai/model-orchestration.js';
import type { VerificationSubsystem } from '../verification/verification-subsystem.js';
import { evaluateTransition } from '../safety/safety-policy.js';

export type StepContext = {
  session_id: string;
  session_lifecycle_state: SessionLifecycleState;
  step_workflow_state: StepWorkflowState;
  state: DerivedState;
  step: Step | null;
  progress: { completed: number; total: number; percentage: number };
  active_warnings: Warning[];
  blocked_state: BlockedState;
};

export type VerificationResponse = {
  verification_result: 'pass' | 'fail' | 'insufficient';
  confidence_score: number;
  session_lifecycle_state: SessionLifecycleState;
  step_workflow_state: StepWorkflowState;
  new_state: DerivedState;
  next_step: Step | null;
  mismatch?: { type?: string; description?: string; expected_diagram?: string };
  additional_evidence_request?: { guidance?: string; focus_area?: string };
  warnings: Warning[];
};

export type ChatResponse = {
  answer: string;
  source_references: Array<{ type: string; ref: string }>;
  suggested_actions: string[];
};

export class WorkflowOrchestrator {
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly manualStore: ManualStore,
    private readonly imageStore: ImageStore,
    private readonly eventLogger: OrchestratorEventLogger,
    private readonly modelLayer: ModelOrchestrationLayer,
    private readonly verificationSubsystem: VerificationSubsystem,
    private readonly confidenceThreshold: number = 0.7,
  ) {}

  async getCurrentStep(sessionId: string): Promise<StepContext> {
    return this.fetchStepContext(sessionId);
  }

  async fetchStepContext(sessionId: string, stepId?: string): Promise<StepContext> {
    const session = await this.loadSessionOrThrow(sessionId);
    const stepGraph = await this.manualStore.getStepGraph(session.manual_id);
    const steps = stepGraph?.steps ?? [];
    const targetId = stepId ?? session.current_step_id;
    const step = steps.find((s) => s.step_id === targetId) ?? null;
    const total = steps.length;
    const completed = session.completed_steps.length;
    return {
      session_id: session.session_id,
      session_lifecycle_state: session.session_lifecycle_state,
      step_workflow_state: session.step_workflow_state,
      state: derivedState(session.session_lifecycle_state, session.step_workflow_state),
      step,
      progress: { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 },
      active_warnings: session.active_warnings,
      blocked_state: session.blocked_state,
    };
  }

  async submitEvidence(sessionId: string, stepId: string, evidenceImage: Buffer, notes?: string): Promise<VerificationResponse> {
    let session = await this.loadSessionOrThrow(sessionId);
    const stepGraph = await this.manualStore.getStepGraph(session.manual_id);
    if (!stepGraph) {
      throw { code: 'MANUAL_NOT_FOUND', message: `Manual ${session.manual_id} not found` };
    }
    const step = stepGraph.steps.find((candidate) => candidate.step_id === stepId);
    if (!step) {
      throw { code: 'STEP_MISMATCH', message: `Step ${stepId} is not part of manual ${session.manual_id}` };
    }
    const manual = await this.manualStore.getManual(session.manual_id);
    const diagramIndex = await this.manualStore.getDiagramIndex(session.manual_id);
    const diagramEntry = diagramIndex?.entries.find((entry) => entry.step_id === stepId);

    if (session.current_step_id !== stepId) {
      throw { code: 'STEP_MISMATCH', message: `Step ${stepId} does not match current step ${session.current_step_id}` };
    }
    if (session.session_lifecycle_state !== SessionLifecycleState.ACTIVE) {
      throw { code: 'INVALID_TRANSITION', message: `Session lifecycle is not ACTIVE` };
    }

    const correlationId = uuidv4();
    const evidenceBase64 = evidenceImage.toString('base64');

    // Upload evidence
    const imageRef = await this.imageStore.upload(evidenceImage, { session_id: sessionId, step_id: stepId, filename: `evidence-${correlationId}.jpg` });
    await this.eventLogger.logEvidenceSubmission({ sessionId, correlationId, stepId, details: { image_ref: imageRef.ref, notes } });

    // Transition to VERIFYING
    if (session.step_workflow_state === StepWorkflowState.IN_PROGRESS) {
      const r1 = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'request_evidence');
      if (!r1.valid) throw { code: r1.code, message: r1.message };
      session.session_lifecycle_state = r1.lifecycle;
      session.step_workflow_state = r1.workflow;
    }
    if (session.step_workflow_state === StepWorkflowState.AWAITING_EVIDENCE) {
      const r2 = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'submit_evidence');
      if (!r2.valid) throw { code: r2.code, message: r2.message };
      session.session_lifecycle_state = r2.lifecycle;
      session.step_workflow_state = r2.workflow;
    }

    await this.eventLogger.logModelRequest({ sessionId, correlationId, promptRef: `verify_step:${stepId}` });
    const proposal = await this.modelLayer.verifyStep({
      sessionId,
      step,
      evidenceImageBase64: evidenceBase64,
      diagramRefs: diagramEntry ? [diagramEntry.image_ref] : [],
      conversationHistory: notes ? [{ role: 'user', content: notes }] : [],
      manualContext: manual?.raw_text,
    });
    const verification = await this.verificationSubsystem.compareEvidence(
      evidenceBase64,
      step.expected_visual_cues,
      this.toDiagramReference(diagramEntry),
    );
    const mismatchClassification = verification.mismatch_detected
      ? (verification.mismatch_classification ?? await this.verificationSubsystem.classifyMismatch(evidenceBase64, step.expected_visual_cues))
      : undefined;
    const confidence_score = Math.min(
      proposal.confidence_score || 1,
      verification.confidence_score || proposal.confidence_score || 0,
    );
    const mismatch_detected = proposal.mismatch_detected || verification.mismatch_detected;
    const mismatch_details = mismatchClassification
      ? {
          type: mismatchClassification.type,
          description: mismatchClassification.description,
          visual_indicator: proposal.mismatch_details.visual_indicator,
        }
      : proposal.mismatch_details;
    const mergedProposal: StepTransitionProposal = {
      ...proposal,
      confidence_score,
      mismatch_detected,
      mismatch_details,
      evidence_references: [...new Set([...proposal.evidence_references, imageRef.ref])],
    };
    await this.eventLogger.logModelResponse({
      sessionId,
      correlationId,
      responseRef: JSON.stringify({
        proposal_id: mergedProposal.proposal_id,
        confidence_score,
        mismatch_detected,
        mismatch_type: mismatch_details.type,
      }),
      confidenceScore: confidence_score,
    });

    const safetyEvaluation = evaluateTransition(mergedProposal, session, stepGraph);
    const requiresAdditionalEvidence = confidence_score < this.confidenceThreshold && safetyEvaluation.result !== 'block';
    const additionalEvidenceRequest = requiresAdditionalEvidence
      ? await this.modelLayer.requestAdditionalEvidence({
          sessionId,
          step,
          evidenceImageBase64: evidenceBase64,
          diagramRefs: diagramEntry ? [diagramEntry.image_ref] : [],
          conversationHistory: notes ? [{ role: 'user', content: notes }] : [],
          manualContext: manual?.raw_text,
        })
      : undefined;
    const now = new Date().toISOString();

    // Add evidence record
    session.evidence_history.push({
      step_id: stepId,
      image_ref: imageRef.ref,
      submitted_at: now,
      confidence_score,
      verification_result: safetyEvaluation.result === 'block' ? 'fail' : requiresAdditionalEvidence ? 'insufficient' : 'pass',
    });

    const proposalWarnings = mergedProposal.warnings.map((warning) => this.mapProposalWarning(stepId, warning.type, warning.message, now));
    const newWarnings: Warning[] = [...proposalWarnings, ...safetyEvaluation.warnings];
    session.active_warnings.push(...newWarnings);

    let verificationResult: 'pass' | 'fail' | 'insufficient';
    let nextStep: Step | null = null;

    await this.eventLogger.logSafetyEvaluation({
      sessionId,
      correlationId,
      stepId,
      result: safetyEvaluation.result,
      details: { confidence_score, requires_additional_evidence: requiresAdditionalEvidence },
    });

    if (safetyEvaluation.result === 'block') {
      // BLOCKED
      verificationResult = 'fail';
      const r = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'verification_fail');
      if (!r.valid) throw { code: r.code, message: r.message };
      session.session_lifecycle_state = r.lifecycle;
      session.step_workflow_state = r.workflow;
      session.blocked_state = {
        is_blocked: true,
        reason: safetyEvaluation.block_reason ?? mismatch_details?.description ?? 'Verification failed',
        mismatch_classification: mismatch_details?.type,
        confidence_score,
        blocked_at: now,
      };
      session.detected_mismatches.push({
        step_id: stepId,
        mismatch_type: mismatchClassification?.type ?? 'other',
        description: mismatch_details?.description ?? '',
        confidence_score,
        detected_at: now,
      });
      session.pending_evidence_request = {};
      await this.eventLogger.logBlockApplied({
        sessionId,
        correlationId,
        stepId,
        details: { reason: session.blocked_state.reason, mismatch_type: mismatch_details?.type },
      });
    } else if (requiresAdditionalEvidence) {
      // INSUFFICIENT
      verificationResult = 'insufficient';
      const r = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'insufficient_evidence');
      if (!r.valid) throw { code: r.code, message: r.message };
      session.session_lifecycle_state = r.lifecycle;
      session.step_workflow_state = r.workflow;
      session.blocked_state = { is_blocked: false };
      session.pending_evidence_request = {
        guidance: additionalEvidenceRequest?.guidance ?? verification.guidance ?? 'Please provide clearer evidence',
        focus_area: additionalEvidenceRequest?.focus_area ?? stepId,
      };
    } else {
      // PASS
      verificationResult = 'pass';
      const r = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'verification_pass');
      if (!r.valid) throw { code: r.code, message: r.message };
      session.session_lifecycle_state = r.lifecycle;
      session.step_workflow_state = r.workflow;
      session.blocked_state = { is_blocked: false };
      session.pending_evidence_request = {};
      session.completed_steps.push({ step_id: stepId, completed_at: now, confidence_score });
      nextStep = stepGraph.steps.find((s) => s.step_number === step.step_number + 1) ?? null;
    }

    for (const warning of newWarnings) {
      await this.eventLogger.logWarningIssued({
        sessionId,
        correlationId,
        stepId,
        details: { type: warning.type, message: warning.message },
      });
    }

    await this.eventLogger.logStateTransition({
      sessionId,
      correlationId,
      fromState: StepWorkflowState.VERIFYING,
      toState: session.step_workflow_state,
      stepId,
    });

    session.updated_at = now;
    await this.sessionStore.save(session);
    const saved = (await this.sessionStore.load(sessionId))!;

    return {
      verification_result: verificationResult,
      confidence_score,
      session_lifecycle_state: saved.session_lifecycle_state,
      step_workflow_state: saved.step_workflow_state,
      new_state: derivedState(saved.session_lifecycle_state, saved.step_workflow_state),
      next_step: nextStep,
      mismatch: mismatch_detected ? {
        type: mismatch_details?.type,
        description: mismatch_details?.description,
        expected_diagram: diagramEntry ? `/api/images/${diagramEntry.image_ref}` : undefined,
      } : undefined,
      additional_evidence_request: verificationResult === 'insufficient' ? saved.pending_evidence_request : undefined,
      warnings: newWarnings,
    };
  }

  async overrideBlock(sessionId: string, stepId: string, overrideReason?: string): Promise<SessionState> {
    const session = await this.loadSessionOrThrow(sessionId);

    if (!session.blocked_state.is_blocked || session.current_step_id !== stepId) {
      throw { code: 'INVALID_TRANSITION', message: `Session is not blocked on step ${stepId}` };
    }

    const correlationId = uuidv4();
    const now = new Date().toISOString();

    session.overrides.push({
      step_id: stepId,
      overridden_at: now,
      user_confirmation: true,
      mismatch_reason: overrideReason ?? session.blocked_state.reason ?? '',
      confidence_at_override: session.blocked_state.confidence_score ?? 0,
    });
    session.blocked_state = { is_blocked: false };

    const r = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'user_override');
    if (!r.valid) throw { code: r.code, message: r.message };
    session.session_lifecycle_state = r.lifecycle;
    session.step_workflow_state = r.workflow;
    session.updated_at = now;

    await this.eventLogger.logOverrideRecorded({ sessionId, correlationId, stepId });
    await this.sessionStore.save(session);
    return (await this.sessionStore.load(sessionId))!;
  }

  async advanceToNextStep(sessionId: string): Promise<SessionState> {
    const session = await this.loadSessionOrThrow(sessionId);
    const { step_workflow_state } = session;

    if (step_workflow_state !== StepWorkflowState.STEP_COMPLETE && step_workflow_state !== StepWorkflowState.OVERRIDDEN) {
      throw { code: 'INVALID_TRANSITION', message: `Cannot advance from workflow state ${step_workflow_state}` };
    }

    const correlationId = uuidv4();
    const stepGraph = await this.manualStore.getStepGraph(session.manual_id);
    const steps = stepGraph?.steps ?? [];
    const currentStep = steps.find((s) => s.step_id === session.current_step_id);
    const nextStep = steps.find((s) => s.step_number === (currentStep?.step_number ?? 0) + 1) ?? null;
    const now = new Date().toISOString();

    if (!nextStep) {
      const r = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'last_step_complete');
      if (!r.valid) throw { code: r.code, message: r.message };
      session.session_lifecycle_state = r.lifecycle;
      session.step_workflow_state = r.workflow;
    } else {
      const r = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'advance_to_next_step');
      if (!r.valid) throw { code: r.code, message: r.message };
      session.session_lifecycle_state = r.lifecycle;
      session.step_workflow_state = r.workflow;
      session.current_step_id = nextStep.step_id;
    }

    await this.eventLogger.logStateTransition({
      sessionId,
      correlationId,
      fromState: step_workflow_state,
      toState: session.step_workflow_state,
      stepId: session.current_step_id,
    });

    session.updated_at = now;
    await this.sessionStore.save(session);
    return (await this.sessionStore.load(sessionId))!;
  }

  async askQuestion(sessionId: string, question: string, contextStepId?: string): Promise<ChatResponse> {
    const session = await this.loadSessionOrThrow(sessionId);
    const manual = await this.manualStore.getManual(session.manual_id);
    const stepGraph = await this.manualStore.getStepGraph(session.manual_id);
    const step = stepGraph?.steps.find((candidate) => candidate.step_id === (contextStepId ?? session.current_step_id));
    const answer: StructuredAnswer = await this.modelLayer.answerQuestion({
      sessionId,
      question,
      step,
      manualContext: manual?.raw_text,
    });
    return answer;
  }

  private toDiagramReference(entry?: DiagramEntry): { diagram_id: string; image_ref: string; description?: string } | undefined {
    if (!entry) return undefined;
    return {
      diagram_id: entry.diagram_id,
      image_ref: entry.image_ref,
      description: entry.description,
    };
  }

  private mapProposalWarning(stepId: string, type: string, message: string, issuedAt: string): Warning {
    const normalizedType = type.toLowerCase().includes('orientation')
      ? 'orientation'
      : type.toLowerCase().includes('mismatch')
        ? 'mismatch'
        : 'low_confidence';
    return {
      warning_id: uuidv4(),
      step_id: stepId,
      type: normalizedType,
      message,
      issued_at: issuedAt,
    };
  }

  private async loadSessionOrThrow(sessionId: string): Promise<SessionState> {
    const session = await this.sessionStore.load(sessionId);
    if (!session) throw { code: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
    return session;
  }
}
