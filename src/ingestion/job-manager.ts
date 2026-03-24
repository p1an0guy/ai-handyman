import { v4 as uuidv4 } from 'uuid';
import type { IngestionJob, IngestionStage } from '../models/index.js';
import type { JobStore, ManualStore, ManualContent } from '../storage/interfaces.js';
import type { OrchestratorEventLogger } from '../orchestrator/event-logger.js';
import { parsePDF, extractDiagrams } from './pdf-parser.js';
import { StepGraphGenerator, DiagramIndexer, validateStepGraph } from './step-graph-generator.js';
import type { ModelOrchestrationLayer } from '../ai/model-orchestration.js';

const STAGES: IngestionStage[] = ['upload_received', 'pdf_parse', 'text_extract', 'diagram_extract', 'step_identify', 'step_graph_assemble', 'diagram_index_generate', 'quality_validate', 'persist'];

export class IngestionJobManager {
  private readonly stepGraphGenerator: StepGraphGenerator;
  private readonly diagramIndexer: DiagramIndexer;

  constructor(
    private readonly jobStore: JobStore,
    private readonly manualStore: ManualStore,
    private readonly modelLayer: ModelOrchestrationLayer,
    private readonly eventLogger: OrchestratorEventLogger,
  ) {
    this.stepGraphGenerator = new StepGraphGenerator(modelLayer);
    this.diagramIndexer = new DiagramIndexer();
  }

  async startIngestionJob(fileBuffer: Buffer, metadata?: { manufacturer?: string; product_name?: string }): Promise<IngestionJob> {
    const jobId = uuidv4();
    const manualId = uuidv4();
    const correlationId = uuidv4();
    const now = new Date().toISOString();

    const job: IngestionJob = {
      job_id: jobId,
      manual_id: manualId,
      status: 'queued',
      stage: 'upload_received',
      progress_percent: 0,
      attempt_count: 1,
      resume_cursor: {},
      result: {},
      errors: [],
      created_at: now,
      updated_at: now,
    };

    await this.jobStore.save(job);
    await this.eventLogger.logIngestionJobEvent({ eventType: 'ingestion_job_started', manualId, correlationId, jobId, jobStage: 'upload_received' });

    // Run pipeline asynchronously (don't await — fire and forget)
    this.runPipeline(job, fileBuffer, metadata, correlationId).catch(() => {});

    return job;
  }

  async getIngestionJob(jobId: string): Promise<IngestionJob> {
    const job = await this.jobStore.load(jobId);
    if (!job) throw { code: 'JOB_NOT_FOUND', message: `Job ${jobId} not found` };
    return job;
  }

  async resumeIngestionJob(jobId: string): Promise<IngestionJob> {
    const job = await this.getIngestionJob(jobId);
    if (job.status !== 'error' && job.status !== 'awaiting_retry') {
      throw { code: 'INVALID_TRANSITION', message: `Job ${jobId} is not in a resumable state (current: ${job.status})` };
    }
    job.status = 'processing';
    job.attempt_count += 1;
    job.updated_at = new Date().toISOString();
    await this.jobStore.update(job);
    await this.eventLogger.logIngestionJobEvent({ eventType: 'ingestion_job_resumed', manualId: job.manual_id, correlationId: uuidv4(), jobId, jobStage: job.stage });
    // Note: actual resume would re-run pipeline from resume_cursor. For v1, return updated job.
    return job;
  }

  private async runPipeline(job: IngestionJob, fileBuffer: Buffer, metadata: { manufacturer?: string; product_name?: string } | undefined, correlationId: string): Promise<void> {
    try {
      job.status = 'processing';

      // Stage: pdf_parse
      await this.advanceStage(job, 'pdf_parse', 10, correlationId);
      const parsed = await parsePDF(fileBuffer);

      // Stage: text_extract
      await this.advanceStage(job, 'text_extract', 25, correlationId);
      const manualContent: ManualContent = {
        manual_id: job.manual_id,
        raw_text: parsed.text,
        page_images: [],
        metadata,
      };

      // Stage: diagram_extract
      await this.advanceStage(job, 'diagram_extract', 40, correlationId);
      const diagrams = await extractDiagrams(fileBuffer, parsed.pageCount);

      // Stage: step_identify + step_graph_assemble
      await this.advanceStage(job, 'step_identify', 55, correlationId);
      const stepGraph = await this.stepGraphGenerator.generate(manualContent);

      await this.advanceStage(job, 'step_graph_assemble', 70, correlationId);

      // Stage: diagram_index_generate
      await this.advanceStage(job, 'diagram_index_generate', 80, correlationId);
      const diagramIndex = this.diagramIndexer.buildIndex(job.manual_id, stepGraph, diagrams);

      // Stage: quality_validate
      await this.advanceStage(job, 'quality_validate', 90, correlationId);
      const validation = validateStepGraph(stepGraph);
      if (!validation.valid) {
        job.errors = validation.errors.map(e => ({ code: e.code, message: e.message }));
        job.status = 'error';
        job.updated_at = new Date().toISOString();
        await this.jobStore.update(job);
        await this.eventLogger.logIngestionJobEvent({ eventType: 'ingestion_job_failed', manualId: job.manual_id, correlationId, jobId: job.job_id, jobStage: 'quality_validate' });
        return;
      }

      // Stage: persist
      await this.advanceStage(job, 'persist', 95, correlationId);
      await this.manualStore.save(manualContent, stepGraph, diagramIndex);

      job.status = 'complete';
      job.progress_percent = 100;
      job.result = { manual_id: job.manual_id, step_graph_ref: `sg-${job.manual_id}`, diagram_index_ref: `di-${job.manual_id}` };
      job.updated_at = new Date().toISOString();
      await this.jobStore.update(job);
      await this.eventLogger.logIngestionJobEvent({ eventType: 'ingestion_job_completed', manualId: job.manual_id, correlationId, jobId: job.job_id, jobStage: 'persist' });

    } catch (err) {
      job.status = 'error';
      job.resume_cursor = { last_completed_stage: this.getPreviousStage(job.stage) };
      const msg = err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : String(err));
      job.errors.push({ code: 'PIPELINE_ERROR', message: msg });
      job.updated_at = new Date().toISOString();
      await this.jobStore.update(job);
      await this.eventLogger.logIngestionJobEvent({ eventType: 'ingestion_job_failed', manualId: job.manual_id, correlationId, jobId: job.job_id, jobStage: job.stage });
    }
  }

  private async advanceStage(job: IngestionJob, stage: IngestionStage, progress: number, correlationId: string): Promise<void> {
    job.stage = stage;
    job.progress_percent = progress;
    job.updated_at = new Date().toISOString();
    await this.jobStore.update(job);
    await this.eventLogger.logIngestionJobEvent({ eventType: 'ingestion_job_updated', manualId: job.manual_id, correlationId, jobId: job.job_id, jobStage: stage });
  }

  private getPreviousStage(current: IngestionStage): IngestionStage | undefined {
    const idx = STAGES.indexOf(current);
    return idx > 0 ? STAGES[idx - 1] : undefined;
  }
}
