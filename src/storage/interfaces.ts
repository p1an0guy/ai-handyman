import type { SessionState, StructuredEvent, IngestionJob } from '../models/index.js';
import type { StepGraph } from '../models/index.js';
import type { DiagramIndex } from '../models/index.js';

export interface SessionFilters {
  manual_id?: string;
  session_lifecycle_state?: string;
}

export interface SessionSummary {
  session_id: string;
  manual_id: string;
  session_lifecycle_state: string;
  step_workflow_state: string;
  created_at: string;
  updated_at: string;
}

export interface EventFilters {
  event_type?: string;
  from_timestamp?: string;
  to_timestamp?: string;
}

export interface ImageMetadata {
  session_id: string;
  step_id: string;
  filename: string;
}

export interface ImageReference {
  ref: string;
  path: string;
}

export interface ManualContent {
  manual_id: string;
  raw_text: string;
  page_images: string[];
  metadata?: { manufacturer?: string; product_name?: string };
}

export interface SessionStore {
  save(session: SessionState): Promise<void>;
  load(sessionId: string): Promise<SessionState | null>;
  list(filters?: SessionFilters): Promise<SessionSummary[]>;
}

export interface EventLog {
  append(event: StructuredEvent): Promise<void>;
  query(sessionId: string, filters?: EventFilters): Promise<StructuredEvent[]>;
  replaySession(sessionId: string): AsyncIterable<StructuredEvent>;
}

export interface ImageStore {
  upload(image: Buffer, metadata: ImageMetadata): Promise<ImageReference>;
  retrieve(ref: ImageReference): Promise<Buffer>;
}

export interface ManualStore {
  save(manual: ManualContent, stepGraph: StepGraph, diagramIndex: DiagramIndex): Promise<void>;
  getManual(manualId: string): Promise<ManualContent | null>;
  getStepGraph(manualId: string): Promise<StepGraph | null>;
  getDiagramIndex(manualId: string): Promise<DiagramIndex | null>;
}

export interface JobStore {
  save(job: IngestionJob): Promise<void>;
  load(jobId: string): Promise<IngestionJob | null>;
  update(job: IngestionJob): Promise<void>;
}
