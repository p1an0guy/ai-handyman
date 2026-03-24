import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  InMemorySessionStore,
  InMemoryEventLog,
  InMemoryImageStore,
  InMemoryManualStore,
  InMemoryJobStore,
} from './storage/index.js';
import { OrchestratorEventLogger, SessionManager, WorkflowOrchestrator } from './orchestrator/index.js';
import { MockAIAdapter } from './ai/ai-adapter.js';
import { ModelOrchestrationLayer } from './ai/model-orchestration.js';
import { IngestionJobManager } from './ingestion/job-manager.js';
import { createRouter } from './api/routes.js';
import { errorHandler } from './api/middleware.js';
import { VerificationSubsystem } from './verification/verification-subsystem.js';

const sessionStore = new InMemorySessionStore();
const eventLog = new InMemoryEventLog();
const imageStore = new InMemoryImageStore();
const manualStore = new InMemoryManualStore();
const jobStore = new InMemoryJobStore();

const mockAIAdapter = new MockAIAdapter();
const eventLogger = new OrchestratorEventLogger(eventLog);
const modelLayer = new ModelOrchestrationLayer(mockAIAdapter);
const verificationSubsystem = new VerificationSubsystem(mockAIAdapter);
const sessionManager = new SessionManager(sessionStore, manualStore, eventLogger);
const workflowOrchestrator = new WorkflowOrchestrator(sessionStore, manualStore, imageStore, eventLogger, modelLayer, verificationSubsystem);
const ingestionJobManager = new IngestionJobManager(jobStore, manualStore, modelLayer, eventLogger);

export const deps = { sessionStore, eventLog, imageStore, manualStore, jobStore, sessionManager, workflowOrchestrator, ingestionJobManager };

const app = express();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '..');
const frontendDistDir = path.resolve(projectRoot, 'src/frontend/dist');

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const apiRouter = createRouter({ sessionManager, workflowOrchestrator, ingestionJobManager, imageStore });
app.use('/api', apiRouter);
app.use(apiRouter);

if (existsSync(frontendDistDir)) {
  app.use(express.static(frontendDistDir));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(frontendDistDir, 'index.html'));
  });
}

app.use(errorHandler);

const PORT = process.env.PORT ?? 3001;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
