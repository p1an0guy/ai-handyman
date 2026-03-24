export interface Part {
  part_id: string;
  name: string;
  quantity: number;
}

export interface Tool {
  tool_id: string;
  name: string;
}

export interface VisualCue {
  description: string;
  diagram_ref?: string;
}

export interface Step {
  step_id: string;
  step_number: number;
  title: string;
  description: string;
  parts_required: Part[];
  tools_required: Tool[];
  safety_notes: string[];
  expected_visual_cues: VisualCue[];
}

export interface Warning {
  warning_id: string;
  step_id: string;
  type: 'prerequisite_skip' | 'low_confidence' | 'orientation' | 'mismatch';
  message: string;
  issued_at: string;
}

export interface BlockedState {
  is_blocked: boolean;
  reason?: string;
  mismatch_classification?: string;
  confidence_score?: number;
  blocked_at?: string;
}

export interface CreateSessionResponse {
  session_id: string;
  resume_token: string;
  session_lifecycle_state: string;
  step_workflow_state: string;
  state: string;
}

export interface StartSessionResponse {
  session_id: string;
  session_lifecycle_state: string;
  step_workflow_state: string;
  state: string;
}

export interface CurrentStepResponse {
  session_id: string;
  session_lifecycle_state: string;
  step_workflow_state: string;
  state: string;
  step: Step | null;
  progress: { completed: number; total: number; percentage: number };
  active_warnings: Warning[];
  blocked_state: BlockedState;
}

export interface VerifyStepResponse {
  verification_result: 'pass' | 'fail' | 'insufficient';
  confidence_score: number;
  session_lifecycle_state: string;
  step_workflow_state: string;
  new_state: string;
  next_step: Step | null;
  mismatch?: { type?: string; description?: string; expected_diagram?: string };
  additional_evidence_request?: { guidance?: string; focus_area?: string };
  warnings: Warning[];
}

export interface IngestionError {
  code: string;
  message: string;
  affected_pages?: number[];
}

export interface IngestionResult {
  manual_id?: string;
  step_graph_ref?: string;
  diagram_index_ref?: string;
}

export interface IngestManualResponse {
  job_id: string;
  manual_id: string;
  status: string;
  status_url: string;
  resume_url: string;
}

export interface IngestionJobResponse {
  job_id: string;
  manual_id: string;
  status: string;
  stage: string;
  progress_percent: number;
  attempt_count: number;
  result: IngestionResult;
  errors: IngestionError[];
}
