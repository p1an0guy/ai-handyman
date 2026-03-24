import { v4 as uuidv4 } from 'uuid';
import type { StructuredEvent, EventType, EventPayload } from '../models/index.js';
import type { EventLog } from '../storage/interfaces.js';

export class OrchestratorEventLogger {
  constructor(private readonly eventLog: EventLog) {}

  async logStateTransition(opts: {
    sessionId: string;
    manualId?: string;
    correlationId: string;
    fromState: string;
    toState: string;
    stepId?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.log('state_transition', {
      session_id: opts.sessionId,
      manual_id: opts.manualId,
      correlation_id: opts.correlationId,
      payload: { from_state: opts.fromState, to_state: opts.toState, step_id: opts.stepId, details: opts.details },
    });
  }

  async logModelRequest(opts: {
    sessionId?: string;
    manualId?: string;
    correlationId: string;
    promptRef: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.log('model_request', {
      session_id: opts.sessionId,
      manual_id: opts.manualId,
      correlation_id: opts.correlationId,
      payload: { prompt_ref: opts.promptRef, details: opts.details },
    });
  }

  async logModelResponse(opts: {
    sessionId?: string;
    manualId?: string;
    correlationId: string;
    responseRef: string;
    confidenceScore?: number;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.log('model_response', {
      session_id: opts.sessionId,
      manual_id: opts.manualId,
      correlation_id: opts.correlationId,
      payload: { response_ref: opts.responseRef, confidence_score: opts.confidenceScore, details: opts.details },
    });
  }

  async logEvidenceSubmission(opts: {
    sessionId: string;
    correlationId: string;
    stepId: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.log('evidence_submission', {
      session_id: opts.sessionId,
      correlation_id: opts.correlationId,
      payload: { step_id: opts.stepId, details: opts.details },
    });
  }

  async logWarningIssued(opts: {
    sessionId: string;
    correlationId: string;
    stepId: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.log('warning_issued', {
      session_id: opts.sessionId,
      correlation_id: opts.correlationId,
      payload: { step_id: opts.stepId, details: opts.details },
    });
  }

  async logBlockApplied(opts: {
    sessionId: string;
    correlationId: string;
    stepId: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.log('block_applied', {
      session_id: opts.sessionId,
      correlation_id: opts.correlationId,
      payload: { step_id: opts.stepId, details: opts.details },
    });
  }

  async logOverrideRecorded(opts: {
    sessionId: string;
    correlationId: string;
    stepId: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.log('override_recorded', {
      session_id: opts.sessionId,
      correlation_id: opts.correlationId,
      payload: { step_id: opts.stepId, details: opts.details },
    });
  }

  async logSessionPaused(opts: { sessionId: string; correlationId: string }): Promise<void> {
    await this.log('session_paused', { session_id: opts.sessionId, correlation_id: opts.correlationId, payload: {} });
  }

  async logSessionResumed(opts: { sessionId: string; correlationId: string }): Promise<void> {
    await this.log('session_resumed', { session_id: opts.sessionId, correlation_id: opts.correlationId, payload: {} });
  }

  async logSafetyEvaluation(opts: {
    sessionId: string;
    correlationId: string;
    stepId: string;
    result: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.log('state_transition', {
      session_id: opts.sessionId,
      correlation_id: opts.correlationId,
      payload: { step_id: opts.stepId, details: { safety_result: opts.result, ...opts.details } },
    });
  }

  async logIngestionJobEvent(opts: {
    eventType: 'ingestion_job_started' | 'ingestion_job_updated' | 'ingestion_job_resumed' | 'ingestion_job_failed' | 'ingestion_job_completed';
    manualId?: string;
    correlationId: string;
    jobId: string;
    jobStage?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.log(opts.eventType, {
      manual_id: opts.manualId,
      correlation_id: opts.correlationId,
      payload: { job_id: opts.jobId, job_stage: opts.jobStage, details: opts.details },
    });
  }

  private async log(
    eventType: EventType,
    data: { session_id?: string; manual_id?: string; correlation_id: string; payload: EventPayload },
  ): Promise<void> {
    const event: StructuredEvent = {
      event_id: uuidv4(),
      session_id: data.session_id,
      manual_id: data.manual_id,
      correlation_id: data.correlation_id,
      timestamp: new Date().toISOString(),
      event_type: eventType,
      payload: data.payload,
    };
    await this.eventLog.append(event);
  }
}
