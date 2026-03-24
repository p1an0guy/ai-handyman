import { v4 as uuidv4 } from 'uuid';
import type { AIAdapter } from './ai-adapter.js';
import type { StepTransitionProposal, StepGraph, Step } from '../models/index.js';
import type { ManualContent } from '../storage/interfaces.js';

export interface VerificationContext {
  sessionId: string;
  step: Step;
  evidenceImageBase64: string;
  diagramRefs: string[];
  conversationHistory: Array<{ role: string; content: string }>;
  manualContext?: string;
}

export interface QuestionContext {
  sessionId: string;
  question: string;
  step?: Step;
  manualContext?: string;
}

export interface StructuredAnswer {
  answer: string;
  source_references: Array<{ type: string; ref: string }>;
  suggested_actions: string[];
}

export interface EvidenceRequest {
  guidance: string;
  focus_area: string;
}

export class ModelOrchestrationLayer {
  constructor(
    private readonly aiAdapter: AIAdapter,
    private readonly confidenceThreshold: number = 0.7,
  ) {}

  async verifyStep(context: VerificationContext): Promise<StepTransitionProposal> {
    const prompt = this.buildVerificationPrompt(context);
    const messages: Array<{ role: string; content: string | Array<{ type: string; data?: string; text?: string }> }> = [
      { role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image', data: context.evidenceImageBase64 },
      ]},
    ];
    const response = await this.aiAdapter.sendMultimodalRequest({ messages, response_format: 'json' });
    return this.parseProposal(response.content, context.sessionId, context.step.step_id);
  }

  async answerQuestion(context: QuestionContext): Promise<StructuredAnswer> {
    const prompt = this.buildQuestionPrompt(context);
    const response = await this.aiAdapter.sendTextRequest({
      messages: [{ role: 'user', content: prompt }],
      response_format: 'json',
    });
    return this.parseAnswer(response.content);
  }

  async extractStepGraph(manual: ManualContent): Promise<StepGraph> {
    const prompt = `Extract a structured step graph from this furniture assembly manual.\n\nManual text:\n${manual.raw_text}\n\nReturn JSON with: manual_id, version ("1.0.0"), total_steps, steps (each with step_id, step_number, title, description, parts_required, tools_required, prerequisites, safety_notes, expected_visual_cues, common_errors, completion_checks).`;
    const response = await this.aiAdapter.sendTextRequest({
      messages: [{ role: 'user', content: prompt }],
      response_format: 'json',
    });
    return this.parseStepGraph(response.content, manual.manual_id);
  }

  async requestAdditionalEvidence(context: VerificationContext): Promise<EvidenceRequest> {
    return {
      guidance: `Please provide a clearer photo of step ${context.step.step_number}: ${context.step.title}. Focus on the areas where parts connect.`,
      focus_area: context.step.expected_visual_cues[0]?.description ?? context.step.title,
    };
  }

  private buildVerificationPrompt(context: VerificationContext): string {
    const cues = context.step.expected_visual_cues.map(c => c.description).join('; ');
    return `Please verify the assembly evidence for this step.\n\nStep ${context.step.step_number}: ${context.step.title}\nDescription: ${context.step.description}\nExpected visual cues: ${cues}\n\nReturn JSON: { "proposal_id": "<uuid>", "session_id": "${context.sessionId}", "current_step_id": "${context.step.step_id}", "proposed_next_step_id": "<next_step_id_or_empty>", "reason": "<explanation>", "confidence_score": <0.0-1.0>, "evidence_references": [], "warnings": [], "mismatch_detected": <bool>, "mismatch_details": { "type": "<optional>", "description": "<optional>" } }`;
  }

  private buildQuestionPrompt(context: QuestionContext): string {
    let prompt = context.question;
    if (context.step) {
      prompt = `Context: Step ${context.step.step_number} - ${context.step.title}\n${context.step.description}\n\nQuestion: ${context.question}\n\nReturn JSON: { "answer": "<answer>", "source_references": [{ "type": "step", "ref": "${context.step.step_id}" }], "suggested_actions": [] }`;
    }
    if (context.manualContext) {
      prompt = `Manual context: ${context.manualContext}\n\n${prompt}`;
    }
    return prompt;
  }

  private parseProposal(content: string, sessionId: string, stepId: string): StepTransitionProposal {
    try {
      const parsed = JSON.parse(content);
      return {
        proposal_id: parsed.proposal_id ?? uuidv4(),
        session_id: parsed.session_id ?? sessionId,
        current_step_id: parsed.current_step_id ?? stepId,
        proposed_next_step_id: parsed.proposed_next_step_id ?? '',
        reason: parsed.reason ?? '',
        confidence_score: typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0,
        evidence_references: Array.isArray(parsed.evidence_references) ? parsed.evidence_references : [],
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        mismatch_detected: Boolean(parsed.mismatch_detected),
        mismatch_details: parsed.mismatch_details ?? {},
      };
    } catch {
      return {
        proposal_id: uuidv4(), session_id: sessionId, current_step_id: stepId,
        proposed_next_step_id: '', reason: 'Failed to parse model response',
        confidence_score: 0, evidence_references: [], warnings: [],
        mismatch_detected: false, mismatch_details: {},
      };
    }
  }

  private parseAnswer(content: string): StructuredAnswer {
    try {
      const parsed = JSON.parse(content);
      return {
        answer: parsed.answer ?? content,
        source_references: Array.isArray(parsed.source_references) ? parsed.source_references : [],
        suggested_actions: Array.isArray(parsed.suggested_actions) ? parsed.suggested_actions : [],
      };
    } catch {
      return { answer: content, source_references: [], suggested_actions: [] };
    }
  }

  private parseStepGraph(content: string, manualId: string): StepGraph {
    try {
      const parsed = JSON.parse(content);
      if (!parsed.steps || !Array.isArray(parsed.steps)) {
        throw new Error('Invalid step graph: missing steps array');
      }
      return {
        manual_id: manualId,
        version: parsed.version ?? '1.0.0',
        total_steps: parsed.steps.length,
        steps: parsed.steps.map((s: Record<string, unknown>, i: number) => ({
          step_id: s.step_id ?? `step-${i + 1}`,
          step_number: typeof s.step_number === 'number' ? s.step_number : i + 1,
          title: s.title ?? `Step ${i + 1}`,
          description: s.description ?? '',
          parts_required: Array.isArray(s.parts_required) ? s.parts_required : [],
          tools_required: Array.isArray(s.tools_required) ? s.tools_required : [],
          prerequisites: Array.isArray(s.prerequisites) ? s.prerequisites : [],
          safety_notes: Array.isArray(s.safety_notes) ? s.safety_notes : [],
          expected_visual_cues: Array.isArray(s.expected_visual_cues) ? s.expected_visual_cues : [],
          common_errors: Array.isArray(s.common_errors) ? s.common_errors : [],
          completion_checks: Array.isArray(s.completion_checks) ? s.completion_checks : [],
        })),
      };
    } catch (err) {
      throw { code: 'STEP_GRAPH_PARSE_ERROR', message: `Failed to parse step graph: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}
