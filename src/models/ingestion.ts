export type IngestionJobStatus = 'queued' | 'processing' | 'awaiting_retry' | 'complete' | 'error';
export type IngestionStage = 'upload_received' | 'pdf_parse' | 'text_extract' | 'diagram_extract' | 'step_identify' | 'step_graph_assemble' | 'diagram_index_generate' | 'quality_validate' | 'persist';
export type ResumeCursor = { last_completed_stage?: IngestionStage; last_processed_page?: number };
export type IngestionResult = { manual_id?: string; step_graph_ref?: string; diagram_index_ref?: string };
export type IngestionError = { code: string; message: string; affected_pages?: number[] };
export type IngestionJob = { job_id: string; manual_id: string; status: IngestionJobStatus; stage: IngestionStage; progress_percent: number; attempt_count: number; resume_cursor: ResumeCursor; result: IngestionResult; errors: IngestionError[]; created_at: string; updated_at: string };
