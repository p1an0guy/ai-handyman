import {
  SessionLifecycleState,
  StepWorkflowState,
  DerivedState,
  SessionState,
  ResumeSnapshot,
} from '../models/index.js';

export type LifecycleTrigger = 'start_session' | 'pause' | 'resume_session' | 'last_step_complete';
export type WorkflowTrigger = 'request_evidence' | 'submit_evidence' | 'verification_pass' | 'verification_fail' | 'insufficient_evidence' | 'user_override' | 're_capture' | 'advance_to_next_step';
export type StateTrigger = LifecycleTrigger | WorkflowTrigger;

export type TransitionResult =
  | { valid: true; lifecycle: SessionLifecycleState; workflow: StepWorkflowState }
  | { valid: false; code: string; message: string };

const { NOT_STARTED, ACTIVE, SESSION_PAUSED, SESSION_COMPLETE } = SessionLifecycleState;
const { IN_PROGRESS, AWAITING_EVIDENCE, VERIFYING, STEP_COMPLETE, BLOCKED, OVERRIDDEN } = StepWorkflowState;

type LKey = `${SessionLifecycleState}:${LifecycleTrigger}`;
type WKey = `${StepWorkflowState}:${WorkflowTrigger}`;

const lifecycleTable: Record<LKey, SessionLifecycleState> = {
  [`${NOT_STARTED}:start_session`]: ACTIVE,
  [`${ACTIVE}:pause`]: SESSION_PAUSED,
  [`${SESSION_PAUSED}:resume_session`]: ACTIVE,
  [`${ACTIVE}:last_step_complete`]: SESSION_COMPLETE,
} as Record<LKey, SessionLifecycleState>;

const workflowTable: Record<WKey, StepWorkflowState> = {
  [`${IN_PROGRESS}:request_evidence`]: AWAITING_EVIDENCE,
  [`${AWAITING_EVIDENCE}:submit_evidence`]: VERIFYING,
  [`${VERIFYING}:verification_pass`]: STEP_COMPLETE,
  [`${VERIFYING}:verification_fail`]: BLOCKED,
  [`${VERIFYING}:insufficient_evidence`]: AWAITING_EVIDENCE,
  [`${BLOCKED}:user_override`]: OVERRIDDEN,
  [`${BLOCKED}:re_capture`]: AWAITING_EVIDENCE,
  [`${OVERRIDDEN}:advance_to_next_step`]: IN_PROGRESS,
  [`${STEP_COMPLETE}:advance_to_next_step`]: IN_PROGRESS,
} as Record<WKey, StepWorkflowState>;

const lifecycleTriggers = new Set<string>(['start_session', 'pause', 'resume_session', 'last_step_complete']);

function isLifecycleTrigger(t: StateTrigger): t is LifecycleTrigger {
  return lifecycleTriggers.has(t);
}

export function validateLifecycleTransition(current: SessionLifecycleState, trigger: LifecycleTrigger): SessionLifecycleState | null {
  return lifecycleTable[`${current}:${trigger}` as LKey] ?? null;
}

export function validateWorkflowTransition(current: StepWorkflowState, trigger: WorkflowTrigger): StepWorkflowState | null {
  return workflowTable[`${current}:${trigger}` as WKey] ?? null;
}

export function validateTransition(currentLifecycle: SessionLifecycleState, currentWorkflow: StepWorkflowState, trigger: StateTrigger): TransitionResult {
  if (isLifecycleTrigger(trigger)) {
    const next = validateLifecycleTransition(currentLifecycle, trigger);
    if (next === null) {
      return { valid: false, code: 'INVALID_TRANSITION', message: `Cannot apply '${trigger}' to lifecycle '${currentLifecycle}' (workflow: '${currentWorkflow}')` };
    }
    return { valid: true, lifecycle: next, workflow: currentWorkflow };
  }
  if (currentLifecycle !== ACTIVE) {
    return { valid: false, code: 'INVALID_TRANSITION', message: `Cannot apply workflow trigger '${trigger}' when lifecycle is '${currentLifecycle}' (must be ACTIVE)` };
  }
  const next = validateWorkflowTransition(currentWorkflow, trigger as WorkflowTrigger);
  if (next === null) {
    return { valid: false, code: 'INVALID_TRANSITION', message: `Cannot apply '${trigger}' to workflow state '${currentWorkflow}' (lifecycle: '${currentLifecycle}')` };
  }
  return { valid: true, lifecycle: currentLifecycle, workflow: next };
}

export function derivedState(lifecycle: SessionLifecycleState, workflow: StepWorkflowState): DerivedState {
  if (lifecycle === SESSION_PAUSED) return SESSION_PAUSED;
  if (lifecycle === SESSION_COMPLETE) return SESSION_COMPLETE;
  return workflow;
}

export function captureResumeSnapshot(session: SessionState): ResumeSnapshot {
  return {
    session_lifecycle_state: session.session_lifecycle_state,
    step_workflow_state: session.step_workflow_state,
    captured_at: new Date().toISOString(),
  };
}

export function restoreFromSnapshot(session: SessionState, snapshot: ResumeSnapshot): { lifecycle: SessionLifecycleState; workflow: StepWorkflowState } {
  return {
    lifecycle: ACTIVE,
    workflow: snapshot.step_workflow_state ?? session.step_workflow_state,
  };
}
