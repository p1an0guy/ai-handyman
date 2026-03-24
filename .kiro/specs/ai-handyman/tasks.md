# Implementation Tasks: AI Handyman

## Phase 1: Foundation

### Task 1: Project setup and configuration
- [ ] Initialize Node.js/TypeScript project with `tsconfig.json`, `package.json`
- [ ] Set up project directory structure: `src/`, `src/models/`, `src/orchestrator/`, `src/ingestion/`, `src/verification/`, `src/safety/`, `src/storage/`, `src/api/`, `src/ai/`, `src/frontend/`
- [ ] Install core dependencies: Express (or Fastify), fast-check, uuid, pdf-parse, multer
- [ ] Configure linting and formatting (ESLint, Prettier)

### Task 2: Define core data model types
- [ ] Define `StepGraph`, `Step`, `Part`, `Tool`, `VisualCue`, `CommonError`, `CompletionCheck` types
- [ ] Define `SessionState` type with all fields (session_lifecycle_state, step_workflow_state, derived state, blocked_state, overrides, evidence_history, active_warnings, detected_mismatches, resume_snapshot, etc.)
- [ ] Define `StepTransitionProposal` type
- [ ] Define `DiagramIndex` and `DiagramEntry` types
- [ ] Define `IngestionJob` type with status, stage, resume_cursor, result, errors
- [ ] Define `StructuredEvent` type for event logging
- [ ] Define `SafetyEvaluation`, `Warning`, `MismatchClassification` types
- [ ] Define `ErrorResponse` schema (code, message, details)

### Task 3: Implement state machine logic
- [ ] Implement `SessionLifecycleState` enum and valid transitions table
- [ ] Implement `StepWorkflowState` enum and valid transitions table
- [ ] Implement `validateTransition(currentLifecycle, currentWorkflow, trigger)` — returns next state tuple or rejection error
- [ ] Implement derived `state` computation from the two state dimensions
- [ ] Implement resume snapshot capture and restore logic (serialize both dimensions + pending state)

### Task 4: Implement storage interfaces and in-memory stores
- [ ] Implement `SessionStore` interface (`save`, `load`, `list`) with in-memory backing
- [ ] Implement `EventLog` interface (`append`, `query`, `replaySession`) with in-memory backing
- [ ] Implement `ImageStore` interface (`upload`, `retrieve`) with local filesystem backing
- [ ] Implement `ManualStore` interface (`save`, `getManual`, `getStepGraph`, `getDiagramIndex`) with in-memory backing
- [ ] Implement `JobStore` interface (`save`, `load`, `update`) with in-memory backing
- [ ] Add optimistic locking (version field) to `SessionStore` for concurrent modification detection

### Task 5: Create development fixtures and smoke harness
- [ ] Create a fixture `StepGraph`, `DiagramIndex`, and sample session payload for local development
- [ ] Create canned ingestion job fixtures for `queued`, `processing`, `complete`, and `error` states
- [ ] Wire `MockAIAdapter` outputs so backend and frontend flows can be exercised before live Gemini integration is stable
- [ ] Add a minimal local smoke script covering: fixture manual -> session create/start -> verify_step -> pause/resume

---

## Phase 2: Backend Vertical Slice

### Task 6: Implement session lifecycle management
- [ ] Implement `createSession(manualId)` — create session with NOT_STARTED state, generate opaque resume token, persist
- [ ] Implement `startSession(sessionId)` — transition `NOT_STARTED -> ACTIVE` and initialize current step workflow state
- [ ] Implement `requestEvidence(sessionId)` — transition current step `IN_PROGRESS -> AWAITING_EVIDENCE` when the session becomes ready for capture
- [ ] Implement `getSession(sessionId)` — load from store
- [ ] Implement `pauseSession(sessionId)` — validate resume token, capture resume_snapshot (both state dimensions), transition to SESSION_PAUSED
- [ ] Implement `resumeSession(sessionId)` — validate resume token, restore from resume_snapshot, transition to ACTIVE

### Task 7: Implement step workflow orchestration
- [ ] Implement `getCurrentStep(sessionId)` — return current step context with progress info
- [ ] Implement `fetchStepContext(sessionId, stepId?)` — return rich context without mutating state
- [ ] Implement `submitEvidence(sessionId, stepId, evidence)` request validation — current step match, active session requirement, valid evidence payload
- [ ] Persist submitted evidence to `ImageStore` and append an `evidence_history` record before verification response handling
- [ ] Transition `AWAITING_EVIDENCE -> VERIFYING` before model evaluation
- [ ] Call verification subsystem, normalize result, and attach evidence references to the resulting proposal
- [ ] Apply safety evaluation and map the result to `STEP_COMPLETE`, `BLOCKED`, or `AWAITING_EVIDENCE`
- [ ] Commit final session state, warnings, mismatch details, and pending evidence guidance
- [ ] Implement `overrideBlock(sessionId, stepId, confirmation)` — validate session is BLOCKED, record override with full context (step_id, timestamp, mismatch_reason, confidence_at_override), transition to OVERRIDDEN
- [ ] Implement `advanceToNextStep(sessionId)` — from STEP_COMPLETE or OVERRIDDEN, advance to next step's IN_PROGRESS; if last step, transition to SESSION_COMPLETE
- [ ] Implement `askQuestion(sessionId, question)` — delegate to Model Orchestration Layer with session context

### Task 8: Implement orchestrator validation and event logging
- [ ] Validate every state transition against state machine before persisting
- [ ] Reject invalid transitions with structured error (code: INVALID_TRANSITION, current_state, attempted_transition)
- [ ] Log all session operations as structured events: state_transition, model_request, model_response, evidence_submission, warning_issued, block_applied, override_recorded, session_paused, session_resumed
- [ ] Log all ingestion job operations as structured events: ingestion_job_started, ingestion_job_updated, ingestion_job_resumed, ingestion_job_failed, ingestion_job_completed
- [ ] Include applicable correlation fields on events (`session_id`, `manual_id`, `job_id`) based on operation type
- [ ] Ensure safety evaluation event is logged before every state transition event
- [ ] Implement idempotency keys for override and evidence submission endpoints

### Task 9: Implement public API endpoints
- [ ] `POST /ingest_manual` — multipart upload, delegates to ingestion job manager, returns 202 with job_id, status_url, and resume_url
- [ ] `GET /ingestion_jobs/:job_id` — returns job status, stage, progress, result, errors
- [ ] `POST /ingestion_jobs/:job_id/resume` — resumes failed ingestion job
- [ ] `POST /sessions` — creates anonymous session, returns session_id and resume_token
- [ ] `POST /session/:session_id/start` — starts a created session and enters the guided assembly flow
- [ ] `GET /session/:session_id/current_step` — returns current step, progress, warnings, blocked state
- [ ] `GET /session/:session_id/step_context` — returns rich step context (optional step_id query param)
- [ ] `POST /session/:session_id/verify_step` — accepts evidence image, returns verification result and new state
- [ ] `POST /session/:session_id/override` — accepts override confirmation, returns new state and override record
- [ ] `POST /session/:session_id/pause` — pauses session with resume token validation
- [ ] `POST /session/:session_id/resume` — resumes session with resume token validation
- [ ] `POST /session/:session_id/ask` — text Q&A, returns answer with source references

### Task 10: Implement typed API contracts and client helpers
- [ ] Define request/response DTOs for all public endpoints in a shared module
- [ ] Implement multipart upload helpers for manual upload and evidence submission
- [ ] Implement a small typed client wrapper used by the frontend to avoid route-shape drift

### Task 11: Implement API error handling and middleware
- [ ] Implement consistent error response format (code, message, details) across all endpoints
- [ ] Implement 404 for session/job not found
- [ ] Implement 409 Conflict for concurrent modification (optimistic locking)
- [ ] Implement 503 for storage write failures
- [ ] Implement request validation middleware (required fields, file format/size checks)

---

## Phase 3: Frontend Vertical Slice

### Task 12: Frontend scaffolding and routing
- [ ] Set up React (or similar) SPA with routing
- [ ] Create page structure: Manual Upload, Ingestion Progress, Assembly Session

### Task 13: Manual ingestion UI
- [ ] Implement PDF upload form with file validation (format, size)
- [ ] Implement ingestion progress polling — poll `GET /ingestion_jobs/:job_id` until complete or error
- [ ] Handle fast-path completions where `POST /ingest_manual` returns a completed job result immediately
- [ ] Display stage progress, percentage, and errors (with affected pages)
- [ ] Navigate to session start on ingestion completion
- [ ] Support resuming failed ingestion jobs via `POST /ingestion_jobs/:job_id/resume`

### Task 14: Session management UI
- [ ] Implement session start (create session, call `POST /session/:id/start`, then request first evidence when applicable)
- [ ] Implement pause/resume with resume token stored in localStorage
- [ ] Handle invalid or expired resume token responses with a recovery path back to manual upload/session creation
- [ ] Implement session completion screen
- [ ] Display restored warnings and blocked state on resume

### Task 15: Assembly session UI
- [ ] Load initial step state from `GET /session/:session_id/current_step`
- [ ] Fetch richer current-step details from `GET /session/:session_id/step_context` when the session screen mounts
- [ ] Display current step with title, description, parts required, tools required, safety notes
- [ ] Display expected diagram from manual alongside step instructions
- [ ] Show session progress bar (completed / total steps)
- [ ] Implement camera capture via `getUserMedia` API for still-image evidence
- [ ] Implement evidence submission — send captured image to `POST /session/:id/verify_step`
- [ ] Render verification results: pass (advance), fail (show mismatch), insufficient (show guidance)
- [ ] Render side-by-side comparison on mismatch (user evidence vs. expected diagram)
- [ ] Display soft warnings (non-blocking, informational)
- [ ] Display blocked state with mismatch reason and override button
- [ ] Implement override flow — confirmation dialog, call `POST /session/:id/override`
- [ ] Implement additional evidence request UI — show guidance and focus area, re-capture button

### Task 16: Text chat UI
- [ ] Implement chat interface for Q&A during assembly
- [ ] Send questions to `POST /session/:id/ask` with optional context_step_id
- [ ] Display answers with source references (manual page, step, diagram)
- [ ] Display suggested actions

### Task 17: Frontend error handling
- [ ] Display current state with explanation when invalid transitions are attempted
- [ ] Show retry button for verification errors
- [ ] Show specific ingestion errors with re-upload option
- [ ] Implement offline indicator with automatic retry on reconnection

---

## Phase 4: AI, Safety, and Verification Hardening

### Task 18: Implement AI adapter abstraction
- [ ] Define `AIAdapter` interface (`sendMultimodalRequest`, `sendTextRequest`)
- [ ] Define `AIRequest` and `AIResponse` types (provider-agnostic)
- [ ] Implement `GeminiDevAPIAdapter` — handles auth, endpoint URLs, request formatting, response unwrapping, rate limiting, retry with exponential backoff (max 3 retries, 1s/2s/4s)
- [ ] Implement `MockAIAdapter` for testing

### Task 19: Implement Model Orchestration Layer
- [ ] Implement verification prompt assembly — manual content, diagrams, evidence, conversation history, and step context
- [ ] Implement Q&A prompt assembly — current step context plus relevant manual grounding
- [ ] Implement step-graph extraction prompt assembly for ingestion jobs
- [ ] Implement `StructuredOutputParser` for `StepTransitionProposal`
- [ ] Implement `StructuredOutputParser` for `StructuredAnswer`
- [ ] Implement `StructuredOutputParser` for `StepGraph`
- [ ] Implement malformed-response handling and schema validation for all parsed model outputs
- [ ] Implement configurable confidence-threshold evaluation shared by verification flows
- [ ] Implement `verifyStep(context)` — build prompt, call adapter, parse response, apply confidence thresholding
- [ ] Implement `answerQuestion(context)` — build prompt, call adapter, parse structured answer
- [ ] Implement `extractStepGraph(manual)` — build prompt, call adapter, parse StepGraph
- [ ] Implement `requestAdditionalEvidence(context)` — return guidance and focus area when confidence is below threshold

### Task 20: Implement Safety/Policy Layer
- [ ] Implement `evaluateTransition(proposal, sessionState, stepGraph)` returning `SafetyEvaluation`
- [ ] Implement prerequisite skip detection — check if skipped steps are prerequisites for later structural steps
- [ ] Implement high-confidence mismatch blocking logic
- [ ] Implement insufficient evidence and low-confidence handling — return to `AWAITING_EVIDENCE` with specific additional evidence guidance
- [ ] Implement orientation mismatch warning logic
- [ ] Ensure soft warnings never block; blocks always allow override

### Task 21: Implement Verification Subsystem
- [ ] Implement `compareEvidence(evidence, expectedCues, diagramRef)` — wraps Gemini verification call, normalizes output to `VerificationResult`
- [ ] Implement `classifyMismatch(evidence, expectedCues)` — returns `MismatchClassification` (wrong_part, wrong_orientation, missing_part, incomplete_step, other)
- [ ] Implement confidence scoring normalization

---

## Phase 5: Manual Ingestion Hardening

### Task 22: Implement PDF parsing and extraction
- [ ] Implement `PDFUploadHandler` — validate file format, size limits
- [ ] Implement `PDFParser` — extract text and images from PDF pages
- [ ] Implement diagram extraction — identify and crop diagram regions from pages

### Task 23: Implement Step Graph generation
- [ ] Implement `StepGraphGenerator` — use Model Orchestration Layer to identify steps from extracted content
- [ ] Implement `DiagramIndexer` — map diagram regions to specific steps, generate `DiagramIndex`
- [ ] Implement `StepGraph` validation — check no orphan steps, valid prerequisite references, sequential step_numbers

### Task 24: Implement Ingestion Job Manager
- [ ] Implement `startIngestionJob(file, metadata)` — create job, persist as queued, run pipeline stages asynchronously
- [ ] Implement background job runner abstraction so ingestion work is decoupled from the request thread
- [ ] Implement pipeline stage progression: `upload_received → pdf_parse → text_extract → diagram_extract → step_identify → step_graph_assemble → diagram_index_generate → quality_validate → persist`
- [ ] Persist job state after every stage transition with updated `progress_percent`
- [ ] Implement `resume_cursor` persistence — save last completed stage and last processed page on failure
- [ ] Implement retry-safe resume semantics so `resumeIngestionJob(jobId)` is idempotent when the same failed job is resumed multiple times
- [ ] Implement `resumeIngestionJob(jobId)` — continue from saved cursor
- [ ] Implement `getIngestionJob(jobId)` — return current status, stage, progress, result, errors
- [ ] Implement structured error handling for malformed/low-quality PDFs (error code, message, affected_pages)

---

## Phase 6: Testing and Validation

### Task 25: Property-based tests (fast-check)
- [ ] Create custom arbitraries: `arbitrarySessionState`, `arbitraryStepGraph`, `arbitraryStepTransitionProposal`, `arbitraryTrigger`, `arbitraryVerifyingSession`, `arbitraryMismatchResult`, `arbitraryLowConfidenceResult`, `arbitraryBlockedSession`, `arbitraryOverrideConfirmation`, `arbitraryMalformedPDF`, `arbitraryFailedIngestionJob`, `arbitraryWarningTransition`, `arbitraryOperationSequence`, `arbitraryOperation`, `arbitrarySessionHistory`
- [ ] Property 1: State machine only permits valid transitions (100+ iterations)
- [ ] Property 2: Session state structural completeness (100+ iterations)
- [ ] Property 3: Transition validation and invalid rejection (100+ iterations)
- [ ] Property 4: Session state serialization round trip (100+ iterations)
- [ ] Property 5: Mismatch detection transitions to BLOCKED (100+ iterations)
- [ ] Property 6: Low confidence → additional evidence request (100+ iterations)
- [ ] Property 7: Override records contain full context (100+ iterations)
- [ ] Property 8: Malformed manual → structured error (100+ iterations)
- [ ] Property 8a: Resumable ingestion jobs (100+ iterations)
- [ ] Property 9: Step_Graph structural completeness (100+ iterations)
- [ ] Property 10: Soft warnings don't block; blocks prevent auto-advance (100+ iterations)
- [ ] Property 11: Safety evaluation precedes every transition (100+ iterations)
- [ ] Property 12: Event log completeness (100+ iterations)
- [ ] Property 13: Event log replay reproduces session state sequence (100+ iterations)

### Task 26: Unit tests
- [ ] Backend Orchestrator: happy path state transition sequence (NOT_STARTED → ACTIVE → ... → SESSION_COMPLETE)
- [ ] Backend Orchestrator: override blocked step then immediately pause
- [ ] Backend Orchestrator: resume session paused while BLOCKED
- [ ] Backend Orchestrator: submit evidence for wrong step (error case)
- [ ] Manual Ingestion: single-page manual, manual with no diagrams
- [ ] Manual Ingestion: resume job from diagram_extract after transient failure
- [ ] Manual Ingestion: empty PDF, password-protected PDF (error cases)
- [ ] Safety/Policy Layer: specific prerequisite skip scenarios
- [ ] Safety/Policy Layer: multiple overrides in one session
- [ ] Safety/Policy Layer: warning + block in same transition
- [ ] Model Orchestration Layer: prompt construction with various context sizes
- [ ] Model Orchestration Layer: structured output parsing (valid and malformed responses)
- [ ] Model Orchestration Layer: adapter interface contract tests
- [ ] Verification Subsystem: confidence score boundary cases (exactly at threshold)

### Task 27: Integration and eval tests
- [ ] End-to-end: upload manual → ingest → create session → verify steps → complete session
- [ ] Eval dataset integration: run verification pipeline against eval tuples, compare to ground-truth labels
- [ ] Regression baseline: flag when verification accuracy drops below established baseline
