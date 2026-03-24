import express from 'express';
import cors from 'cors';
import {
  InMemorySessionStore,
  InMemoryEventLog,
  InMemoryImageStore,
  InMemoryManualStore,
  InMemoryJobStore,
} from './storage/index.js';
import { OrchestratorEventLogger, SessionManager, WorkflowOrchestrator } from './orchestrator/index.js';
import { MockAIAdapter } from './ai/ai-adapter.js';
import { createRouter } from './api/routes.js';
import { errorHandler } from './api/middleware.js';

const sessionStore = new InMemorySessionStore();
const eventLog = new InMemoryEventLog();
const imageStore = new InMemoryImageStore();
const manualStore = new InMemoryManualStore();
const jobStore = new InMemoryJobStore();

const eventLogger = new OrchestratorEventLogger(eventLog);
const sessionManager = new SessionManager(sessionStore, manualStore);
const workflowOrchestrator = new WorkflowOrchestrator(sessionStore, manualStore, imageStore, eventLogger, new MockAIAdapter());

export const deps = { sessionStore, eventLog, imageStore, manualStore, jobStore, sessionManager, workflowOrchestrator };

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(createRouter({ sessionManager, workflowOrchestrator }));
app.use(errorHandler);

const PORT = process.env.PORT ?? 3001;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
