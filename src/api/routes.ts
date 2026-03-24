import express from 'express';
import multer from 'multer';
import { derivedState } from '../orchestrator/state-machine.js';
import type { SessionManager } from '../orchestrator/session-manager.js';
import type { WorkflowOrchestrator } from '../orchestrator/workflow-orchestrator.js';
import type { IngestionJobManager } from '../ingestion/job-manager.js';
import type { ImageStore } from '../storage/interfaces.js';

export interface AppDependencies {
  sessionManager: SessionManager;
  workflowOrchestrator: WorkflowOrchestrator;
  ingestionJobManager: IngestionJobManager;
  imageStore: ImageStore;
}

export function createRouter(deps: AppDependencies): express.Router {
  const { sessionManager, workflowOrchestrator, ingestionJobManager, imageStore } = deps;
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  // POST /sessions
  router.post('/sessions', async (req, res, next) => {
    try {
      const { manual_id } = req.body as { manual_id: string };
      const session = await sessionManager.createSession(manual_id);
      res.status(201).json({
        session_id: session.session_id,
        resume_token: session.resume_token_ref,
        session_lifecycle_state: session.session_lifecycle_state,
        step_workflow_state: session.step_workflow_state,
        state: derivedState(session.session_lifecycle_state, session.step_workflow_state),
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /session/:session_id/start
  router.post('/session/:session_id/start', async (req, res, next) => {
    try {
      await sessionManager.startSession(req.params.session_id);
      const session = await sessionManager.requestEvidence(req.params.session_id);
      res.json({
        session_id: session.session_id,
        session_lifecycle_state: session.session_lifecycle_state,
        step_workflow_state: session.step_workflow_state,
        state: derivedState(session.session_lifecycle_state, session.step_workflow_state),
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /session/:session_id/current_step
  router.get('/session/:session_id/current_step', async (req, res, next) => {
    try {
      const ctx = await workflowOrchestrator.getCurrentStep(req.params.session_id);
      res.json(ctx);
    } catch (err) {
      next(err);
    }
  });

  // GET /session/:session_id/step_context
  router.get('/session/:session_id/step_context', async (req, res, next) => {
    try {
      const stepId = req.query.step_id as string | undefined;
      const ctx = await workflowOrchestrator.fetchStepContext(req.params.session_id, stepId);
      res.json(ctx);
    } catch (err) {
      next(err);
    }
  });

  // POST /session/:session_id/verify_step
  router.post('/session/:session_id/verify_step', async (req, res, next) => {
    try {
      const { step_id, evidence_image, notes } = req.body as { step_id: string; evidence_image: string; notes?: string };
      const imageBuffer = Buffer.from(evidence_image, 'base64');
      const result = await workflowOrchestrator.submitEvidence(req.params.session_id, step_id, imageBuffer, notes);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /session/:session_id/override
  router.post('/session/:session_id/override', async (req, res, next) => {
    try {
      const { step_id, override_reason } = req.body as { step_id: string; user_confirmation: true; override_reason?: string };
      const session = await workflowOrchestrator.overrideBlock(req.params.session_id, step_id, override_reason);
      res.json({
        accepted: true,
        session_lifecycle_state: session.session_lifecycle_state,
        step_workflow_state: session.step_workflow_state,
        new_state: derivedState(session.session_lifecycle_state, session.step_workflow_state),
        override_record: session.overrides[session.overrides.length - 1],
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /session/:session_id/pause
  router.post('/session/:session_id/pause', async (req, res, next) => {
    try {
      const { resume_token } = req.body as { resume_token: string };
      const session = await sessionManager.pauseSession(req.params.session_id, resume_token);
      res.json({
        session_id: session.session_id,
        session_lifecycle_state: session.session_lifecycle_state,
        step_workflow_state: session.step_workflow_state,
        state: derivedState(session.session_lifecycle_state, session.step_workflow_state),
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /session/:session_id/resume
  router.post('/session/:session_id/resume', async (req, res, next) => {
    try {
      const { resume_token } = req.body as { resume_token: string };
      const session = await sessionManager.resumeSession(req.params.session_id, resume_token);
      res.json({
        session_id: session.session_id,
        session_lifecycle_state: session.session_lifecycle_state,
        step_workflow_state: session.step_workflow_state,
        state: derivedState(session.session_lifecycle_state, session.step_workflow_state),
        restored_warnings: session.active_warnings,
        restored_blocked_state: session.blocked_state,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /session/:session_id/ask
  router.post('/session/:session_id/ask', async (req, res, next) => {
    try {
      const { question, context_step_id } = req.body as { question: string; context_step_id?: string };
      const result = await workflowOrchestrator.askQuestion(req.params.session_id, question, context_step_id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /session/:session_id/advance
  router.post('/session/:session_id/advance', async (req, res, next) => {
    try {
      const session = await workflowOrchestrator.advanceToNextStep(req.params.session_id);
      res.json({
        session_id: session.session_id,
        session_lifecycle_state: session.session_lifecycle_state,
        step_workflow_state: session.step_workflow_state,
        state: derivedState(session.session_lifecycle_state, session.step_workflow_state),
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /images/:ref
  router.get('/images/:ref', async (req, res) => {
    try {
      const image = await imageStore.retrieve({ ref: req.params.ref, path: '' });
      res.type('image/jpeg').send(image);
    } catch {
      const label = escapeForSvg(req.params.ref);
      res.type('image/svg+xml').send(
        `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
          <rect width="640" height="360" fill="#f5f5f5"/>
          <rect x="24" y="24" width="592" height="312" rx="12" fill="#ffffff" stroke="#d0d0d0"/>
          <text x="320" y="160" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#444444">Reference diagram unavailable</text>
          <text x="320" y="196" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#777777">${label}</text>
        </svg>`,
      );
    }
  });

  // POST /ingest_manual
  router.post('/ingest_manual', upload.single('file'), async (req, res, next) => {
    try {
      const body = req.body as {
        file_base64?: string;
        manufacturer?: string;
        product_name?: string;
        metadata?: { manufacturer?: string; product_name?: string };
      };
      const metadata = body.metadata ?? {
        manufacturer: body.manufacturer,
        product_name: body.product_name,
      };
      const buffer = req.file?.buffer ?? (body.file_base64 ? Buffer.from(body.file_base64, 'base64') : Buffer.alloc(0));
      if (buffer.length === 0) {
        throw { code: 'VALIDATION_ERROR', message: 'A PDF file upload is required' };
      }
      const job = await ingestionJobManager.startIngestionJob(buffer, metadata);
      res.status(202).json({
        job_id: job.job_id,
        manual_id: job.manual_id,
        status: job.status,
        status_url: `/ingestion_jobs/${job.job_id}`,
        resume_url: `/ingestion_jobs/${job.job_id}/resume`,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /ingestion_jobs/:job_id
  router.get('/ingestion_jobs/:job_id', async (req, res, next) => {
    try {
      const job = await ingestionJobManager.getIngestionJob(req.params.job_id);
      res.json(job);
    } catch (err) {
      next(err);
    }
  });

  // POST /ingestion_jobs/:job_id/resume
  router.post('/ingestion_jobs/:job_id/resume', async (req, res, next) => {
    try {
      const job = await ingestionJobManager.resumeIngestionJob(req.params.job_id);
      res.json(job);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function escapeForSvg(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
