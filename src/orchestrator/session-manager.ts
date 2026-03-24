import { v4 as uuidv4 } from 'uuid';
import { SessionState, SessionLifecycleState, StepWorkflowState } from '../models/index.js';
import { validateTransition, captureResumeSnapshot, restoreFromSnapshot } from './state-machine.js';
import type { SessionStore, ManualStore } from '../storage/interfaces.js';

export class SessionManager {
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly manualStore: ManualStore,
  ) {}

  async createSession(manualId: string): Promise<SessionState> {
    const stepGraph = await this.manualStore.getStepGraph(manualId);
    if (!stepGraph || stepGraph.steps.length === 0) {
      throw { code: 'MANUAL_NOT_FOUND', message: `Manual ${manualId} not found or has no steps` };
    }
    const now = new Date().toISOString();
    const session: SessionState = {
      session_id: uuidv4(),
      manual_id: manualId,
      resume_token_ref: uuidv4(),
      session_lifecycle_state: SessionLifecycleState.NOT_STARTED,
      step_workflow_state: StepWorkflowState.IN_PROGRESS,
      current_step_id: stepGraph.steps[0].step_id,
      completed_steps: [],
      skipped_steps: [],
      blocked_state: { is_blocked: false },
      overrides: [],
      evidence_history: [],
      active_warnings: [],
      detected_mismatches: [],
      pending_evidence_request: {},
      resume_snapshot: {},
      version: 0,
      created_at: now,
      updated_at: now,
    };
    await this.sessionStore.save(session);
    return (await this.sessionStore.load(session.session_id))!;
  }

  async startSession(sessionId: string): Promise<SessionState> {
    const session = await this.loadOrThrow(sessionId);
    const result = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'start_session');
    if (!result.valid) throw { code: result.code, message: result.message };
    session.session_lifecycle_state = result.lifecycle;
    session.step_workflow_state = result.workflow;
    session.updated_at = new Date().toISOString();
    await this.sessionStore.save(session);
    return (await this.sessionStore.load(sessionId))!;
  }

  async requestEvidence(sessionId: string): Promise<SessionState> {
    const session = await this.loadOrThrow(sessionId);
    const result = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'request_evidence');
    if (!result.valid) throw { code: result.code, message: result.message };
    session.session_lifecycle_state = result.lifecycle;
    session.step_workflow_state = result.workflow;
    session.updated_at = new Date().toISOString();
    await this.sessionStore.save(session);
    return (await this.sessionStore.load(sessionId))!;
  }

  async getSession(sessionId: string): Promise<SessionState> {
    return this.loadOrThrow(sessionId);
  }

  async pauseSession(sessionId: string, resumeToken: string): Promise<SessionState> {
    const session = await this.loadOrThrow(sessionId);
    if (session.resume_token_ref !== resumeToken) {
      throw { code: 'INVALID_RESUME_TOKEN', message: 'Invalid resume token' };
    }
    const snapshot = captureResumeSnapshot(session);
    const result = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'pause');
    if (!result.valid) throw { code: result.code, message: result.message };
    session.session_lifecycle_state = result.lifecycle;
    session.step_workflow_state = result.workflow;
    session.resume_snapshot = snapshot;
    session.updated_at = new Date().toISOString();
    await this.sessionStore.save(session);
    return (await this.sessionStore.load(sessionId))!;
  }

  async resumeSession(sessionId: string, resumeToken: string): Promise<SessionState> {
    const session = await this.loadOrThrow(sessionId);
    if (session.resume_token_ref !== resumeToken) {
      throw { code: 'INVALID_RESUME_TOKEN', message: 'Invalid resume token' };
    }
    const result = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'resume_session');
    if (!result.valid) throw { code: result.code, message: result.message };
    const restored = restoreFromSnapshot(session, session.resume_snapshot);
    session.session_lifecycle_state = restored.lifecycle;
    session.step_workflow_state = restored.workflow;
    session.updated_at = new Date().toISOString();
    await this.sessionStore.save(session);
    return (await this.sessionStore.load(sessionId))!;
  }

  private async loadOrThrow(sessionId: string): Promise<SessionState> {
    const session = await this.sessionStore.load(sessionId);
    if (!session) throw { code: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
    return session;
  }
}
