export enum SessionLifecycleState {
  NOT_STARTED = 'NOT_STARTED',
  ACTIVE = 'ACTIVE',
  SESSION_PAUSED = 'SESSION_PAUSED',
  SESSION_COMPLETE = 'SESSION_COMPLETE',
}

export enum StepWorkflowState {
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_EVIDENCE = 'AWAITING_EVIDENCE',
  VERIFYING = 'VERIFYING',
  STEP_COMPLETE = 'STEP_COMPLETE',
  BLOCKED = 'BLOCKED',
  OVERRIDDEN = 'OVERRIDDEN',
}

export type DerivedState = SessionLifecycleState | StepWorkflowState;

export type CompletedStep = { step_id: string; completed_at: string; confidence_score: number };
export type SkippedStep = { step_id: string; skipped_at: string; reason: string };
export type BlockedState = { is_blocked: boolean; reason?: string; mismatch_classification?: string; confidence_score?: number; blocked_at?: string };
export type OverrideRecord = { step_id: string; overridden_at: string; user_confirmation: boolean; mismatch_reason: string; confidence_at_override: number };
export type EvidenceRecord = { step_id: string; image_ref: string; submitted_at: string; confidence_score: number; verification_result: 'pass' | 'fail' | 'insufficient' };
export type Warning = { warning_id: string; step_id: string; type: 'prerequisite_skip' | 'low_confidence' | 'orientation' | 'mismatch'; message: string; issued_at: string };
export type DetectedMismatch = { step_id: string; mismatch_type: 'wrong_part' | 'wrong_orientation' | 'missing_part' | 'incomplete_step' | 'other'; description: string; confidence_score: number; detected_at: string };
export type PendingEvidenceRequest = { guidance?: string; focus_area?: string };
export type ResumeSnapshot = { session_lifecycle_state?: SessionLifecycleState; step_workflow_state?: StepWorkflowState; captured_at?: string };
export type SessionState = { session_id: string; manual_id: string; user_id?: string; resume_token_ref: string; session_lifecycle_state: SessionLifecycleState; step_workflow_state: StepWorkflowState; current_step_id: string; completed_steps: CompletedStep[]; skipped_steps: SkippedStep[]; blocked_state: BlockedState; overrides: OverrideRecord[]; evidence_history: EvidenceRecord[]; active_warnings: Warning[]; detected_mismatches: DetectedMismatch[]; pending_evidence_request: PendingEvidenceRequest; resume_snapshot: ResumeSnapshot; version: number; created_at: string; updated_at: string };
