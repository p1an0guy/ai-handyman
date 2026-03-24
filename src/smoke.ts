// Smoke test: fixture manual -> session create -> verify_step -> pause/resume
// Run with: npx tsx src/smoke.ts

import { sampleStepGraph, sampleDiagramIndex, createSampleSession } from './fixtures/index.js';
import { InMemorySessionStore, InMemoryEventLog, InMemoryManualStore } from './storage/index.js';
import { validateTransition, derivedState, captureResumeSnapshot, restoreFromSnapshot } from './orchestrator/state-machine.js';
import { v4 as uuidv4 } from 'uuid';

async function smoke() {
  console.log('=== AI Handyman Smoke Test ===\n');

  // 1. Set up stores
  const sessionStore = new InMemorySessionStore();
  const eventLog = new InMemoryEventLog();
  const manualStore = new InMemoryManualStore();

  // 2. Persist sample manual
  await manualStore.save(
    { manual_id: sampleStepGraph.manual_id, raw_text: 'Sample bookshelf manual', page_images: [] },
    sampleStepGraph,
    sampleDiagramIndex,
  );
  console.log('✓ Manual persisted');

  // 3. Create session
  const session = createSampleSession();
  await sessionStore.save(session);
  session.version++;
  console.log(`✓ Session created: ${session.session_id}`);
  console.log(`  State: ${derivedState(session.session_lifecycle_state, session.step_workflow_state)}`);

  // 4. Start session
  const startResult = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'start_session');
  if (!startResult.valid) { console.error('✗ Start failed:', startResult.message); process.exit(1); }
  session.session_lifecycle_state = startResult.lifecycle;
  session.step_workflow_state = startResult.workflow;
  session.updated_at = new Date().toISOString();
  await sessionStore.save(session);
  session.version++;
  console.log(`✓ Session started: ${derivedState(session.session_lifecycle_state, session.step_workflow_state)}`);

  // 5. Request evidence
  const reqEvResult = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'request_evidence');
  if (!reqEvResult.valid) { console.error('✗ Request evidence failed:', reqEvResult.message); process.exit(1); }
  session.session_lifecycle_state = reqEvResult.lifecycle;
  session.step_workflow_state = reqEvResult.workflow;
  session.updated_at = new Date().toISOString();
  await sessionStore.save(session);
  session.version++;
  console.log(`✓ Evidence requested: ${derivedState(session.session_lifecycle_state, session.step_workflow_state)}`);

  // 6. Submit evidence
  const subEvResult = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'submit_evidence');
  if (!subEvResult.valid) { console.error('✗ Submit evidence failed:', subEvResult.message); process.exit(1); }
  session.session_lifecycle_state = subEvResult.lifecycle;
  session.step_workflow_state = subEvResult.workflow;
  session.updated_at = new Date().toISOString();
  await sessionStore.save(session);
  session.version++;
  console.log(`✓ Evidence submitted: ${derivedState(session.session_lifecycle_state, session.step_workflow_state)}`);

  // 7. Verification pass
  const verifyResult = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'verification_pass');
  if (!verifyResult.valid) { console.error('✗ Verify failed:', verifyResult.message); process.exit(1); }
  session.session_lifecycle_state = verifyResult.lifecycle;
  session.step_workflow_state = verifyResult.workflow;
  session.updated_at = new Date().toISOString();
  await sessionStore.save(session);
  session.version++;
  console.log(`✓ Verification passed: ${derivedState(session.session_lifecycle_state, session.step_workflow_state)}`);

  // 8. Pause session
  const snapshot = captureResumeSnapshot(session);
  const pauseResult = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'pause');
  if (!pauseResult.valid) { console.error('✗ Pause failed:', pauseResult.message); process.exit(1); }
  session.session_lifecycle_state = pauseResult.lifecycle;
  session.step_workflow_state = pauseResult.workflow;
  session.resume_snapshot = snapshot;
  session.updated_at = new Date().toISOString();
  await sessionStore.save(session);
  session.version++;
  console.log(`✓ Session paused: ${derivedState(session.session_lifecycle_state, session.step_workflow_state)}`);

  // 9. Resume session
  const resumeResult = validateTransition(session.session_lifecycle_state, session.step_workflow_state, 'resume_session');
  if (!resumeResult.valid) { console.error('✗ Resume failed:', resumeResult.message); process.exit(1); }
  const restored = restoreFromSnapshot(session, session.resume_snapshot);
  session.session_lifecycle_state = restored.lifecycle;
  session.step_workflow_state = restored.workflow;
  session.updated_at = new Date().toISOString();
  await sessionStore.save(session);
  session.version++;
  console.log(`✓ Session resumed: ${derivedState(session.session_lifecycle_state, session.step_workflow_state)}`);

  // 10. Log an event
  await eventLog.append({
    event_id: uuidv4(),
    session_id: session.session_id,
    correlation_id: uuidv4(),
    timestamp: new Date().toISOString(),
    event_type: 'state_transition',
    payload: { from_state: 'SESSION_PAUSED', to_state: 'STEP_COMPLETE' },
  });
  const events = await eventLog.query(session.session_id);
  console.log(`✓ Event logged (${events.length} events in log)`);

  console.log('\n=== Smoke Test Passed ===');
}

smoke().catch((err) => { console.error('Smoke test failed:', err); process.exit(1); });
