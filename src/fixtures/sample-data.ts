import { StepGraph, DiagramIndex, SessionState, IngestionJob } from '../models/index.js';
import { SessionLifecycleState, StepWorkflowState } from '../models/index.js';
import { v4 as uuidv4 } from 'uuid';

export const SAMPLE_MANUAL_ID = 'manual-bookshelf-001';

export const sampleStepGraph: StepGraph = {
  manual_id: SAMPLE_MANUAL_ID,
  version: '1.0.0',
  total_steps: 3,
  steps: [
    {
      step_id: 'step-1',
      step_number: 1,
      title: 'Attach side panels to base',
      description: 'Connect the two side panels (A) to the base panel (B) using wooden dowels and cam locks.',
      parts_required: [{ part_id: 'A', name: 'Side Panel', quantity: 2 }, { part_id: 'B', name: 'Base Panel', quantity: 1 }],
      tools_required: [{ tool_id: 'T1', name: 'Phillips screwdriver' }],
      prerequisites: [],
      safety_notes: ['Ensure panels are on a flat surface'],
      expected_visual_cues: [{ description: 'Side panels perpendicular to base, cam locks engaged' }],
      common_errors: [{ error_type: 'orientation', description: 'Side panel installed backwards', visual_indicator: 'Pre-drilled holes facing outward' }],
      completion_checks: [{ check_id: 'c1', description: 'Both side panels firmly attached', verification_type: 'visual' }],
    },
    {
      step_id: 'step-2',
      step_number: 2,
      title: 'Install shelves',
      description: 'Insert shelf panels (C) into the shelf pin holes at desired heights.',
      parts_required: [{ part_id: 'C', name: 'Shelf Panel', quantity: 3 }],
      tools_required: [],
      prerequisites: ['step-1'],
      safety_notes: [],
      expected_visual_cues: [{ description: 'Shelves level and resting on pins' }],
      common_errors: [{ error_type: 'missing_part', description: 'Shelf pins not inserted before shelf' }],
      completion_checks: [{ check_id: 'c2', description: 'All shelves level', verification_type: 'visual' }],
    },
    {
      step_id: 'step-3',
      step_number: 3,
      title: 'Attach back panel',
      description: 'Nail the back panel (D) to the rear of the assembled frame.',
      parts_required: [{ part_id: 'D', name: 'Back Panel', quantity: 1 }],
      tools_required: [{ tool_id: 'T2', name: 'Hammer' }],
      prerequisites: ['step-1', 'step-2'],
      safety_notes: ['Be careful with nails'],
      expected_visual_cues: [{ description: 'Back panel flush with frame edges' }],
      common_errors: [{ error_type: 'orientation', description: 'Back panel upside down' }],
      completion_checks: [{ check_id: 'c3', description: 'Back panel secure with no gaps', verification_type: 'visual' }],
    },
  ],
};

export const sampleDiagramIndex: DiagramIndex = {
  manual_id: SAMPLE_MANUAL_ID,
  entries: [
    { diagram_id: 'diag-1', step_id: 'step-1', page_number: 1, bounding_box: { x: 0, y: 0, width: 400, height: 300 }, image_ref: 'diag-img-1', description: 'Side panel attachment' },
    { diagram_id: 'diag-2', step_id: 'step-2', page_number: 2, bounding_box: { x: 0, y: 0, width: 400, height: 300 }, image_ref: 'diag-img-2', description: 'Shelf installation' },
    { diagram_id: 'diag-3', step_id: 'step-3', page_number: 3, bounding_box: { x: 0, y: 0, width: 400, height: 300 }, image_ref: 'diag-img-3', description: 'Back panel attachment' },
  ],
};

export function createSampleSession(manualId: string = SAMPLE_MANUAL_ID): SessionState {
  const now = new Date().toISOString();
  return {
    session_id: uuidv4(),
    manual_id: manualId,
    resume_token_ref: uuidv4(),
    session_lifecycle_state: SessionLifecycleState.NOT_STARTED,
    step_workflow_state: StepWorkflowState.IN_PROGRESS,
    current_step_id: 'step-1',
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
}

export function createSampleIngestionJob(status: 'queued' | 'processing' | 'complete' | 'error' = 'queued'): IngestionJob {
  const now = new Date().toISOString();
  const base: IngestionJob = {
    job_id: uuidv4(),
    manual_id: SAMPLE_MANUAL_ID,
    status,
    stage: 'upload_received',
    progress_percent: 0,
    attempt_count: 1,
    resume_cursor: {},
    result: {},
    errors: [],
    created_at: now,
    updated_at: now,
  };
  if (status === 'processing') {
    base.stage = 'step_identify';
    base.progress_percent = 50;
  } else if (status === 'complete') {
    base.stage = 'persist';
    base.progress_percent = 100;
    base.result = { manual_id: SAMPLE_MANUAL_ID, step_graph_ref: 'sg-ref-1', diagram_index_ref: 'di-ref-1' };
  } else if (status === 'error') {
    base.stage = 'pdf_parse';
    base.progress_percent = 10;
    base.errors = [{ code: 'PDF_CORRUPT', message: 'Unable to parse pages 3-5', affected_pages: [3, 4, 5] }];
  }
  return base;
}
