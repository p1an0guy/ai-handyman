import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './session-manager.js';
import { InMemorySessionStore, InMemoryManualStore } from '../storage/index.js';
import { sampleStepGraph, sampleDiagramIndex, SAMPLE_MANUAL_ID } from '../fixtures/index.js';
import { SessionLifecycleState } from '../models/index.js';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let sessionStore: InMemorySessionStore;
  let manualStore: InMemoryManualStore;

  beforeEach(async () => {
    sessionStore = new InMemorySessionStore();
    manualStore = new InMemoryManualStore();
    await manualStore.save({ manual_id: SAMPLE_MANUAL_ID, raw_text: 'test', page_images: [] }, sampleStepGraph, sampleDiagramIndex);
    sessionManager = new SessionManager(sessionStore, manualStore);
  });

  it('creates a session with NOT_STARTED state', async () => {
    const session = await sessionManager.createSession(SAMPLE_MANUAL_ID);
    expect(session.session_lifecycle_state).toBe(SessionLifecycleState.NOT_STARTED);
    expect(session.current_step_id).toBe('step-1');
    expect(session.resume_token_ref).toBeDefined();
  });

  it('starts a session transitioning to ACTIVE', async () => {
    const created = await sessionManager.createSession(SAMPLE_MANUAL_ID);
    const started = await sessionManager.startSession(created.session_id);
    expect(started.session_lifecycle_state).toBe(SessionLifecycleState.ACTIVE);
  });

  it('rejects starting an already active session', async () => {
    const created = await sessionManager.createSession(SAMPLE_MANUAL_ID);
    await sessionManager.startSession(created.session_id);
    await expect(sessionManager.startSession(created.session_id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('pauses and resumes a session', async () => {
    const created = await sessionManager.createSession(SAMPLE_MANUAL_ID);
    const started = await sessionManager.startSession(created.session_id);
    const paused = await sessionManager.pauseSession(started.session_id, started.resume_token_ref);
    expect(paused.session_lifecycle_state).toBe(SessionLifecycleState.SESSION_PAUSED);
    const resumed = await sessionManager.resumeSession(paused.session_id, paused.resume_token_ref);
    expect(resumed.session_lifecycle_state).toBe(SessionLifecycleState.ACTIVE);
  });

  it('rejects pause with invalid resume token', async () => {
    const created = await sessionManager.createSession(SAMPLE_MANUAL_ID);
    const started = await sessionManager.startSession(created.session_id);
    await expect(sessionManager.pauseSession(started.session_id, 'wrong-token')).rejects.toMatchObject({ code: 'INVALID_RESUME_TOKEN' });
  });

  it('rejects creating session for non-existent manual', async () => {
    await expect(sessionManager.createSession('non-existent')).rejects.toMatchObject({ code: 'MANUAL_NOT_FOUND' });
  });

  it('throws SESSION_NOT_FOUND for invalid session id', async () => {
    await expect(sessionManager.getSession('non-existent')).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });
});
