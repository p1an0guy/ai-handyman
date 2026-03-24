import type { SessionLifecycleState, StepWorkflowState, DerivedState, Step, Warning, BlockedState } from '../models/index.js';

// POST /sessions
export type CreateSessionRequest = { manual_id: string };
export type CreateSessionResponse = {
  session_id: string;
  resume_token: string;
  session_lifecycle_state: SessionLifecycleState;
  step_workflow_state: StepWorkflowState;
  state: DerivedState;
};

// POST /session/:id/start
export type StartSessionResponse = {
  session_id: string;
  session_lifecycle_state: SessionLifecycleState;
  step_workflow_state: StepWorkflowState;
  state: DerivedState;
};

// GET /session/:id/current_step
export type CurrentStepResponse = {
  session_id: string;
  session_lifecycle_state: SessionLifecycleState;
  step_workflow_state: StepWorkflowState;
  state: DerivedState;
  step: Step | null;
  progress: { completed: number; total: number; percentage: number };
  active_warnings: Warning[];
  blocked_state: BlockedState;
};

// GET /session/:id/step_context
export type StepContextResponse = CurrentStepResponse;

// POST /session/:id/verify_step
export type VerifyStepRequest = { step_id: string; evidence_image: string; notes?: string };
export type VerifyStepResponse = {
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

// POST /session/:id/override
export type OverrideRequest = { step_id: string; user_confirmation: boolean; override_reason?: string };
export type OverrideResponse = {
  accepted: boolean;
  session_lifecycle_state: SessionLifecycleState;
  step_workflow_state: StepWorkflowState;
  new_state: DerivedState;
  override_record: { step_id: string; overridden_at: string; mismatch_reason: string; confidence_at_override: number };
};

// POST /session/:id/pause
export type PauseRequest = { resume_token: string };
export type PauseResponse = {
  session_id: string;
  session_lifecycle_state: SessionLifecycleState;
  step_workflow_state: StepWorkflowState;
  state: DerivedState;
};

// POST /session/:id/resume
export type ResumeRequest = { resume_token: string };
export type ResumeResponse = {
  session_id: string;
  session_lifecycle_state: SessionLifecycleState;
  step_workflow_state: StepWorkflowState;
  state: DerivedState;
  restored_warnings: Warning[];
  restored_blocked_state: BlockedState | null;
};

// POST /session/:id/ask
export type AskRequest = { question: string; context_step_id?: string };
export type AskResponse = {
  answer: string;
  source_references: Array<{ type: string; ref: string }>;
  suggested_actions: string[];
};

// POST /session/:id/advance
export type AdvanceResponse = {
  session_id: string;
  session_lifecycle_state: SessionLifecycleState;
  step_workflow_state: StepWorkflowState;
  state: DerivedState;
  current_step_id: string;
};

// POST /ingest_manual
export type IngestManualResponse = {
  job_id: string;
  manual_id: string;
  status: string;
  status_url: string;
  resume_url: string;
};

// GET /ingestion_jobs/:id
export type IngestionJobResponse = {
  job_id: string;
  status: string;
  stage: string;
  progress_percent: number;
};
