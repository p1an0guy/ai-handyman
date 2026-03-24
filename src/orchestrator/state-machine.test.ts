import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SessionLifecycleState, StepWorkflowState } from '../models/index.js';
import type { SessionState, StepTransitionProposal } from '../models/index.js';
import {
  validateTransition, validateLifecycleTransition, validateWorkflowTransition,
  derivedState, captureResumeSnapshot, restoreFromSnapshot,
  type LifecycleTrigger, type WorkflowTrigger, type StateTrigger,
} from './state-machine.js';

// --- Custom Arbitraries ---

const arbLifecycleState = fc.constantFrom(...Object.values(SessionLifecycleState));
const arbWorkflowState = fc.constantFrom(...Object.values(StepWorkflowState));
const arbLifecycleTrigger = fc.constantFrom<LifecycleTrigger>('start_session', 'pause', 'resume_session', 'last_step_complete');
const arbWorkflowTrigger = fc.constantFrom<WorkflowTrigger>('request_evidence', 'submit_evidence', 'verification_pass', 'verification_fail', 'insufficient_evidence', 'user_override', 're_capture', 'advance_to_next_step');
const arbTrigger: fc.Arbitrary<StateTrigger> = fc.oneof(arbLifecycleTrigger, arbWorkflowTrigger);

const arbSessionState: fc.Arbitrary<SessionState> = fc.record({
  session_id: fc.uuid(),
  manual_id: fc.uuid(),
  resume_token_ref: fc.uuid(),
  session_lifecycle_state: arbLifecycleState,
  step_workflow_state: arbWorkflowState,
  current_step_id: fc.constant('step-1'),
  completed_steps: fc.constant([]),
  skipped_steps: fc.constant([]),
  blocked_state: fc.constant({ is_blocked: false }),
  overrides: fc.constant([]),
  evidence_history: fc.constant([]),
  active_warnings: fc.constant([]),
  detected_mismatches: fc.constant([]),
  pending_evidence_request: fc.constant({}),
  resume_snapshot: fc.constant({}),
  version: fc.nat({ max: 100 }),
  created_at: fc.constant(new Date().toISOString()),
  updated_at: fc.constant(new Date().toISOString()),
});

// Valid lifecycle transitions
const VALID_LIFECYCLE: Array<[SessionLifecycleState, LifecycleTrigger, SessionLifecycleState]> = [
  [SessionLifecycleState.NOT_STARTED, 'start_session', SessionLifecycleState.ACTIVE],
  [SessionLifecycleState.ACTIVE, 'pause', SessionLifecycleState.SESSION_PAUSED],
  [SessionLifecycleState.SESSION_PAUSED, 'resume_session', SessionLifecycleState.ACTIVE],
  [SessionLifecycleState.ACTIVE, 'last_step_complete', SessionLifecycleState.SESSION_COMPLETE],
];

// Valid workflow transitions
const VALID_WORKFLOW: Array<[StepWorkflowState, WorkflowTrigger, StepWorkflowState]> = [
  [StepWorkflowState.IN_PROGRESS, 'request_evidence', StepWorkflowState.AWAITING_EVIDENCE],
  [StepWorkflowState.AWAITING_EVIDENCE, 'submit_evidence', StepWorkflowState.VERIFYING],
  [StepWorkflowState.VERIFYING, 'verification_pass', StepWorkflowState.STEP_COMPLETE],
  [StepWorkflowState.VERIFYING, 'verification_fail', StepWorkflowState.BLOCKED],
  [StepWorkflowState.VERIFYING, 'insufficient_evidence', StepWorkflowState.AWAITING_EVIDENCE],
  [StepWorkflowState.BLOCKED, 'user_override', StepWorkflowState.OVERRIDDEN],
  [StepWorkflowState.BLOCKED, 're_capture', StepWorkflowState.AWAITING_EVIDENCE],
  [StepWorkflowState.OVERRIDDEN, 'advance_to_next_step', StepWorkflowState.IN_PROGRESS],
  [StepWorkflowState.STEP_COMPLETE, 'advance_to_next_step', StepWorkflowState.IN_PROGRESS],
];

describe('Property-Based Tests', () => {
  // Feature: ai-handyman, Property 1: State machine only permits valid transitions
  it('Property 1: only valid transitions produce next states', () => {
    fc.assert(fc.property(arbLifecycleState, arbWorkflowState, arbTrigger, (lifecycle, workflow, trigger) => {
      const result = validateTransition(lifecycle, workflow, trigger);
      if (result.valid) {
        const isValidLifecycle = VALID_LIFECYCLE.some(([from, t, to]) => from === lifecycle && t === trigger && to === result.lifecycle);
        const isValidWorkflow = VALID_WORKFLOW.some(([from, t, to]) => from === workflow && t === trigger && to === result.workflow);
        const lifecycleUnchanged = result.lifecycle === lifecycle;
        const workflowUnchanged = result.workflow === workflow;
        expect(isValidLifecycle && workflowUnchanged || isValidWorkflow && lifecycleUnchanged).toBe(true);
      }
    }), { numRuns: 200 });
  });

  // Feature: ai-handyman, Property 2: Session state structural completeness
  it('Property 2: session state has all required fields', () => {
    fc.assert(fc.property(arbSessionState, (session) => {
      expect(session.session_id).toBeDefined();
      expect(session.manual_id).toBeDefined();
      expect(session.resume_token_ref).toBeDefined();
      expect(session.session_lifecycle_state).toBeDefined();
      expect(session.step_workflow_state).toBeDefined();
      expect(session.current_step_id).toBeDefined();
      expect(Array.isArray(session.completed_steps)).toBe(true);
      expect(Array.isArray(session.skipped_steps)).toBe(true);
      expect(session.blocked_state).toBeDefined();
      expect(Array.isArray(session.overrides)).toBe(true);
      expect(Array.isArray(session.evidence_history)).toBe(true);
      expect(Array.isArray(session.active_warnings)).toBe(true);
      expect(Array.isArray(session.detected_mismatches)).toBe(true);
      expect(session.pending_evidence_request).toBeDefined();
      expect(session.resume_snapshot).toBeDefined();
      expect(typeof session.version).toBe('number');
      expect(session.created_at).toBeDefined();
      expect(session.updated_at).toBeDefined();
    }), { numRuns: 100 });
  });

  // Feature: ai-handyman, Property 3: Transition validation and invalid rejection
  it('Property 3: invalid transitions are rejected with structured error', () => {
    fc.assert(fc.property(arbLifecycleState, arbWorkflowState, arbTrigger, (lifecycle, workflow, trigger) => {
      const result = validateTransition(lifecycle, workflow, trigger);
      if (!result.valid) {
        expect(result.code).toBe('INVALID_TRANSITION');
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
      }
    }), { numRuns: 200 });
  });

  // Feature: ai-handyman, Property 4: Session state serialization round trip
  it('Property 4: serialize/deserialize preserves session state', () => {
    fc.assert(fc.property(arbSessionState, (session) => {
      const serialized = JSON.stringify(session);
      const deserialized = JSON.parse(serialized) as SessionState;
      expect(deserialized.session_id).toBe(session.session_id);
      expect(deserialized.session_lifecycle_state).toBe(session.session_lifecycle_state);
      expect(deserialized.step_workflow_state).toBe(session.step_workflow_state);
      expect(deserialized.current_step_id).toBe(session.current_step_id);
      expect(deserialized.version).toBe(session.version);
      expect(deserialized.blocked_state).toEqual(session.blocked_state);
      expect(deserialized.completed_steps).toEqual(session.completed_steps);
      expect(deserialized.overrides).toEqual(session.overrides);
      expect(deserialized.resume_snapshot).toEqual(session.resume_snapshot);
    }), { numRuns: 100 });
  });

  // Feature: ai-handyman, Property 5: Mismatch detection transitions to BLOCKED
  it('Property 5: verification_fail transitions VERIFYING to BLOCKED', () => {
    fc.assert(fc.property(fc.constant(null), () => {
      const result = validateTransition(SessionLifecycleState.ACTIVE, StepWorkflowState.VERIFYING, 'verification_fail');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.workflow).toBe(StepWorkflowState.BLOCKED);
      }
    }), { numRuns: 100 });
  });

  // Feature: ai-handyman, Property 6: Low confidence -> additional evidence request
  it('Property 6: insufficient_evidence transitions VERIFYING to AWAITING_EVIDENCE', () => {
    fc.assert(fc.property(fc.constant(null), () => {
      const result = validateTransition(SessionLifecycleState.ACTIVE, StepWorkflowState.VERIFYING, 'insufficient_evidence');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.workflow).toBe(StepWorkflowState.AWAITING_EVIDENCE);
      }
    }), { numRuns: 100 });
  });

  // Feature: ai-handyman, Property 8: derived state computation
  it('Property 8: derived state follows lifecycle priority rules', () => {
    fc.assert(fc.property(arbLifecycleState, arbWorkflowState, (lifecycle, workflow) => {
      const derived = derivedState(lifecycle, workflow);
      if (lifecycle === SessionLifecycleState.SESSION_PAUSED) {
        expect(derived).toBe(SessionLifecycleState.SESSION_PAUSED);
      } else if (lifecycle === SessionLifecycleState.SESSION_COMPLETE) {
        expect(derived).toBe(SessionLifecycleState.SESSION_COMPLETE);
      } else {
        expect(derived).toBe(workflow);
      }
    }), { numRuns: 200 });
  });

  // Feature: ai-handyman, Property 9: resume snapshot round trip
  it('Property 9: capture and restore snapshot preserves workflow state', () => {
    fc.assert(fc.property(arbSessionState, (session) => {
      session.session_lifecycle_state = SessionLifecycleState.ACTIVE;
      const snapshot = captureResumeSnapshot(session);
      expect(snapshot.session_lifecycle_state).toBe(SessionLifecycleState.ACTIVE);
      expect(snapshot.step_workflow_state).toBe(session.step_workflow_state);
      expect(snapshot.captured_at).toBeDefined();
      const restored = restoreFromSnapshot(session, snapshot);
      expect(restored.lifecycle).toBe(SessionLifecycleState.ACTIVE);
      expect(restored.workflow).toBe(session.step_workflow_state);
    }), { numRuns: 100 });
  });

  // Feature: ai-handyman, Property 10: Soft warnings don't block; blocks prevent auto-advance
  it('Property 10: BLOCKED state rejects advance_to_next_step', () => {
    fc.assert(fc.property(fc.constant(null), () => {
      const result = validateTransition(SessionLifecycleState.ACTIVE, StepWorkflowState.BLOCKED, 'advance_to_next_step');
      expect(result.valid).toBe(false);
    }), { numRuns: 100 });
  });

  // Feature: ai-handyman, Property 10b: STEP_COMPLETE and OVERRIDDEN allow advance
  it('Property 10b: STEP_COMPLETE and OVERRIDDEN allow advance_to_next_step', () => {
    fc.assert(fc.property(
      fc.constantFrom(StepWorkflowState.STEP_COMPLETE, StepWorkflowState.OVERRIDDEN),
      (workflow) => {
        const result = validateTransition(SessionLifecycleState.ACTIVE, workflow, 'advance_to_next_step');
        expect(result.valid).toBe(true);
        if (result.valid) expect(result.workflow).toBe(StepWorkflowState.IN_PROGRESS);
      }
    ), { numRuns: 100 });
  });

  // Feature: ai-handyman, Property 11: workflow triggers require ACTIVE lifecycle
  it('Property 11: workflow triggers rejected when lifecycle is not ACTIVE', () => {
    const nonActive = fc.constantFrom(SessionLifecycleState.NOT_STARTED, SessionLifecycleState.SESSION_PAUSED, SessionLifecycleState.SESSION_COMPLETE);
    fc.assert(fc.property(nonActive, arbWorkflowState, arbWorkflowTrigger, (lifecycle, workflow, trigger) => {
      const result = validateTransition(lifecycle, workflow, trigger);
      expect(result.valid).toBe(false);
    }), { numRuns: 200 });
  });
});
