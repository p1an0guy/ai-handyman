import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemorySessionStore, InMemoryEventLog, InMemoryImageStore,
  InMemoryManualStore,
} from './storage/index.js';
import { SessionManager } from './orchestrator/session-manager.js';
import { WorkflowOrchestrator } from './orchestrator/workflow-orchestrator.js';
import { OrchestratorEventLogger } from './orchestrator/event-logger.js';
import { MockAIAdapter } from './ai/ai-adapter.js';
import { ModelOrchestrationLayer } from './ai/model-orchestration.js';
import { VerificationSubsystem } from './verification/verification-subsystem.js';
import { sampleStepGraph, sampleDiagramIndex, SAMPLE_MANUAL_ID } from './fixtures/index.js';
import { SessionLifecycleState, StepWorkflowState } from './models/index.js';
import { derivedState } from './orchestrator/state-machine.js';

describe('Integration: Full Assembly Flow', () => {
  let sessionStore: InMemorySessionStore;
  let eventLog: InMemoryEventLog;
  let imageStore: InMemoryImageStore;
  let manualStore: InMemoryManualStore;
  let eventLogger: OrchestratorEventLogger;
  let sessionManager: SessionManager;
  let workflowOrchestrator: WorkflowOrchestrator;

  beforeEach(async () => {
    sessionStore = new InMemorySessionStore();
    eventLog = new InMemoryEventLog();
    imageStore = new InMemoryImageStore();
    manualStore = new InMemoryManualStore();
    eventLogger = new OrchestratorEventLogger(eventLog);
    const mockAdapter = new MockAIAdapter();
    const modelLayer = new ModelOrchestrationLayer(mockAdapter);
    const verificationSubsystem = new VerificationSubsystem(mockAdapter);
    sessionManager = new SessionManager(sessionStore, manualStore, eventLogger);
    workflowOrchestrator = new WorkflowOrchestrator(sessionStore, manualStore, imageStore, eventLogger, modelLayer, verificationSubsystem);

    await manualStore.save(
      { manual_id: SAMPLE_MANUAL_ID, raw_text: 'Bookshelf assembly manual', page_images: [] },
      sampleStepGraph,
      sampleDiagramIndex,
    );
  });

  it('completes a full 3-step assembly session', async () => {
    const created = await sessionManager.createSession(SAMPLE_MANUAL_ID);
    expect(created.session_lifecycle_state).toBe(SessionLifecycleState.NOT_STARTED);
    expect(created.current_step_id).toBe('step-1');

    const started = await sessionManager.startSession(created.session_id);
    expect(started.session_lifecycle_state).toBe(SessionLifecycleState.ACTIVE);

    const ready = await sessionManager.requestEvidence(started.session_id);
    expect(ready.step_workflow_state).toBe(StepWorkflowState.AWAITING_EVIDENCE);

    const fakeEvidence = Buffer.from('fake-image-data');
    const verify1 = await workflowOrchestrator.submitEvidence(created.session_id, 'step-1', fakeEvidence);
    expect(verify1.verification_result).toBe('pass');
    expect(verify1.new_state).toBe(StepWorkflowState.STEP_COMPLETE);

    const advanced1 = await workflowOrchestrator.advanceToNextStep(created.session_id);
    expect(advanced1.current_step_id).toBe('step-2');
    expect(advanced1.step_workflow_state).toBe(StepWorkflowState.IN_PROGRESS);

    await sessionManager.requestEvidence(created.session_id);
    const verify2 = await workflowOrchestrator.submitEvidence(created.session_id, 'step-2', fakeEvidence);
    expect(verify2.verification_result).toBe('pass');

    const advanced2 = await workflowOrchestrator.advanceToNextStep(created.session_id);
    expect(advanced2.current_step_id).toBe('step-3');

    await sessionManager.requestEvidence(created.session_id);
    const verify3 = await workflowOrchestrator.submitEvidence(created.session_id, 'step-3', fakeEvidence);
    expect(verify3.verification_result).toBe('pass');

    const final = await workflowOrchestrator.advanceToNextStep(created.session_id);
    expect(final.session_lifecycle_state).toBe(SessionLifecycleState.SESSION_COMPLETE);
    expect(derivedState(final.session_lifecycle_state, final.step_workflow_state)).toBe(SessionLifecycleState.SESSION_COMPLETE);
    expect(final.completed_steps).toHaveLength(3);
  });

  it('handles pause and resume mid-assembly', async () => {
    const created = await sessionManager.createSession(SAMPLE_MANUAL_ID);
    const started = await sessionManager.startSession(created.session_id);
    await sessionManager.requestEvidence(started.session_id);
    await workflowOrchestrator.submitEvidence(created.session_id, 'step-1', Buffer.from('img'));

    const paused = await sessionManager.pauseSession(created.session_id, started.resume_token_ref);
    expect(paused.session_lifecycle_state).toBe(SessionLifecycleState.SESSION_PAUSED);
    expect(derivedState(paused.session_lifecycle_state, paused.step_workflow_state)).toBe(SessionLifecycleState.SESSION_PAUSED);

    const resumed = await sessionManager.resumeSession(created.session_id, paused.resume_token_ref);
    expect(resumed.session_lifecycle_state).toBe(SessionLifecycleState.ACTIVE);
    expect(resumed.step_workflow_state).toBe(StepWorkflowState.STEP_COMPLETE);
  });

  it('records events for all operations', async () => {
    const created = await sessionManager.createSession(SAMPLE_MANUAL_ID);
    await sessionManager.startSession(created.session_id);
    await sessionManager.requestEvidence(created.session_id);
    await workflowOrchestrator.submitEvidence(created.session_id, 'step-1', Buffer.from('img'));

    const events = await eventLog.query(created.session_id);
    expect(events.length).toBeGreaterThan(0);
    const types = events.map(e => e.event_type);
    expect(types).toContain('evidence_submission');
  });

  it('Q&A works during a session', async () => {
    const created = await sessionManager.createSession(SAMPLE_MANUAL_ID);
    await sessionManager.startSession(created.session_id);
    const answer = await workflowOrchestrator.askQuestion(created.session_id, 'How do I attach the side panels?');
    expect(answer.answer).toBeDefined();
    expect(typeof answer.answer).toBe('string');
  });

  it('getCurrentStep returns correct context', async () => {
    const created = await sessionManager.createSession(SAMPLE_MANUAL_ID);
    await sessionManager.startSession(created.session_id);
    const ctx = await workflowOrchestrator.getCurrentStep(created.session_id);
    expect(ctx.step?.step_id).toBe('step-1');
    expect(ctx.step?.title).toBe('Attach side panels to base');
    expect(ctx.progress.total).toBe(3);
    expect(ctx.progress.completed).toBe(0);
  });
});
