# Requirements Document

## Introduction

AI Handyman is a real-time assembly copilot that transforms static flat-pack furniture manuals into interactive, step-by-step guided assembly experiences. The system combines camera-based visual verification, text chat, uploaded manuals/diagrams, and explicit backend-owned workflow state to guide users through assembly. It compares user progress against manual diagrams, answers questions in real time, tracks progress step by step, and catches likely mistakes before they compound. The v1 targets web as the primary platform, uses Gemini as the multimodal reasoning layer behind a backend abstraction, and implements "real-time" via guided still-image evidence capture plus text chat rather than continuous video streaming.

## Glossary

- **Assembly_Session**: A stateful interaction between a user and the system for assembling a specific piece of furniture, persisted across interruptions.
- **Step_Graph**: A structured, ordered representation of assembly steps extracted from a manual, including parts, tools, prerequisites, safety notes, expected visual cues, common errors, and completion checks.
- **Evidence_Capture**: A still image or burst of images taken by the user's camera at the system's request to verify assembly progress.
- **Step_Verification**: The process of comparing user-submitted evidence against expected visual cues from the manual to determine if a step is correctly completed.
- **Mismatch**: A detected discrepancy between user-submitted evidence and the expected state for a given assembly step.
- **Blocked_State**: A workflow state where progression to the next step is prevented because evidence is insufficient or a mismatch is likely.
- **Override**: A user action that forces progression past a blocked state; the override is recorded in state.
- **Soft_Warning**: A non-blocking advisory message alerting the user to a potential issue; the user may proceed without resolving it.
- **Backend_Orchestrator**: The server-side service responsible for owning authoritative workflow state, validating model-proposed state transitions, and coordinating between the frontend, model, and storage layers.
- **Manual_Ingestion**: The process of uploading a PDF or manual document and extracting a structured Step_Graph from it.
- **Gemini_Reasoning_Layer**: The multimodal AI model (Gemini) used for visual verification, question answering, step-graph extraction, and mismatch detection, accessed via the Gemini Developer API behind a backend abstraction.
- **Confidence_Score**: A numeric value representing the model's certainty in a verification result or state transition proposal.
- **Step_Transition_Proposal**: A structured output from the Gemini_Reasoning_Layer proposing a change in workflow state, which must be validated by the Backend_Orchestrator before being applied.
- **Session_State**: The complete, serialized representation of an Assembly_Session including current step, completed steps, skipped steps, blocked states, overrides, evidence history, warnings, and mismatches.
- **Diagram_Index**: A mapping of cropped or indexed diagram regions from the manual to specific steps in the Step_Graph.
- **Safety_Policy_Layer**: The component responsible for evaluating whether a proposed progression is safe and issuing Soft_Warnings when it is not.
- **Eval_Dataset**: A curated set of manual/image/state tuples used to measure system accuracy and regression.

## Requirements

### Requirement 1: Product Scope Definition — V1 User Journey

**User Story:** As a product stakeholder, I want a clearly defined v1 user journey for flat-pack furniture assembly, so that the team builds the smallest differentiated end-to-end MVP.

#### Acceptance Criteria

1. THE Requirements_Document SHALL define the exact v1 user journey as: (a) user uploads a flat-pack furniture manual, (b) system ingests and produces a Step_Graph, (c) user starts an Assembly_Session, (d) system presents the current step with expected diagram, (e) user captures evidence via camera, (f) system verifies evidence and proposes step transition or flags mismatch, (g) user may ask clarifying questions at any point, (h) user may override blocked steps with recorded override, (i) session may be interrupted and resumed.
2. THE Requirements_Document SHALL enumerate in-scope behaviors: manual upload/ingestion, step-graph generation, step-by-step guided assembly, still-image evidence capture, text chat Q&A, visual step verification, mismatch detection, blocked progression, user override with logging, session resume.
3. THE Requirements_Document SHALL enumerate out-of-scope behaviors for v1: continuous video streaming as primary mode, voice interaction, general DIY repair, Lego or non-furniture domains, tutorial URL/video ingestion as primary source, multi-user collaboration, offline mode, native mobile apps.
4. THE Requirements_Document SHALL define the smallest end-to-end MVP as: single-manual upload, step-graph extraction, at least one full guided assembly session with evidence capture, verification, mismatch detection, and session resume.

### Requirement 2: Domain Choice Rationale

**User Story:** As a product stakeholder, I want a documented rationale for choosing flat-pack furniture as the v1 domain, so that the team understands why this domain is tractable and what risks remain.

#### Acceptance Criteria

1. THE Requirements_Document SHALL explain why flat-pack furniture is a better v1 domain than Lego or general DIY repair, citing at least: (a) standardized manual formats from major manufacturers, (b) discrete, visually distinguishable assembly steps, (c) limited part variety per project, (d) lower safety risk than electrical/plumbing DIY, (e) large addressable user base with real pain points.
2. THE Requirements_Document SHALL identify specific characteristics that make visual verification tractable for furniture assembly: (a) parts are large enough for camera capture, (b) orientation and spatial relationships are verifiable from still images, (c) manuals typically include clear diagrams with numbered parts, (d) step completion is visually confirmable (e.g., screws inserted, panels aligned).
3. THE Requirements_Document SHALL call out residual risks within furniture assembly: (a) some steps involve hidden joints not visible from outside, (b) lighting and camera angle variability, (c) manual quality varies across manufacturers, (d) some steps are ambiguous even to humans, (e) 3D spatial reasoning from 2D images has inherent limitations.

### Requirement 3: Architecture Options

**User Story:** As a technical lead, I want a comparison of viable architectures, so that the team can make an informed decision with explicit tradeoffs.

#### Acceptance Criteria

1. THE Requirements_Document SHALL present Architecture Option A (Standard Request/Response Multimodal Backend Orchestration) with: advantages, disadvantages, implementation complexity, latency implications, testing implications, and future scalability implications.
2. THE Requirements_Document SHALL present Architecture Option B (Backend-Owned Live API Session Architecture) with: advantages, disadvantages, implementation complexity, latency implications, testing implications, and future scalability implications.
3. THE Requirements_Document SHALL present Architecture Option C (Client-Direct Live API Architecture) with: advantages, disadvantages, implementation complexity, latency implications, testing implications, and future scalability implications.
4. THE Requirements_Document SHALL NOT recommend an architecture in this section; the recommendation SHALL appear only in Requirement 4.

### Requirement 4: Recommended Architecture

**User Story:** As a technical lead, I want a clear architecture recommendation with justification, so that the team can proceed with implementation.

#### Acceptance Criteria

1. THE Requirements_Document SHALL recommend one architecture from the options in Requirement 3, given the project decisions (camera+text, furniture-first scope, hackathon demo with production-hardening path).
2. THE Requirements_Document SHALL explain why the recommended architecture best matches: (a) camera + text interaction mode, (b) furniture-first scope, (c) future production hardening.
3. THE Requirements_Document SHALL explain why the Live API should or should not be foundational in v1, and under what conditions it could be added later.

### Requirement 5: System Components

**User Story:** As a developer, I want a clear breakdown of system components and their responsibilities, so that I can plan implementation work.

#### Acceptance Criteria

1. THE Requirements_Document SHALL define Frontend responsibilities including: displaying current step and expected diagram, capturing still-image evidence, rendering mismatch reasons, showing next requested evidence capture, text chat interface, session management UI.
2. THE Requirements_Document SHALL define Backend services including: API gateway, session management, state persistence, event logging.
3. THE Requirements_Document SHALL define the Model Orchestration Layer including: prompt construction, context assembly (manual + diagram + user image + conversation history), structured output parsing, confidence thresholding, Gemini Developer API integration behind a backend abstraction that could later target Vertex AI.
4. THE Requirements_Document SHALL define Storage and Event Logging including: session state persistence, evidence image storage, event log for all state transitions, audit trail for overrides and warnings.
5. THE Requirements_Document SHALL define the Safety/Policy Layer including: soft-warning evaluation, unsafe-progression detection, warning/block/override interaction rules.
6. THE Requirements_Document SHALL define the File/Manual Ingestion Layer including: PDF upload, manual parsing, diagram extraction, Step_Graph generation.
7. THE Requirements_Document SHALL define the Verification Subsystem including: evidence-to-diagram comparison, confidence scoring, mismatch classification, additional-evidence request logic.


### Requirement 6: State Model

**User Story:** As a developer, I want an authoritative workflow state machine definition, so that the backend can own state and the model cannot silently advance the workflow.

#### Acceptance Criteria

1. THE Requirements_Document SHALL define a state machine with at minimum the following states: NOT_STARTED, IN_PROGRESS, AWAITING_EVIDENCE, VERIFYING, STEP_COMPLETE, BLOCKED, OVERRIDDEN, SESSION_PAUSED, SESSION_COMPLETE.
2. THE Requirements_Document SHALL represent the following in the state model: current step index, list of completed steps, list of skipped steps, blocked state with reason, override state with timestamp and user confirmation, evidence confidence score per step, list of active warnings, list of detected mismatches, resume state (sufficient to restore a session after interruption).
3. WHEN the Gemini_Reasoning_Layer proposes a state change, THE Backend_Orchestrator SHALL validate the proposal against the current state machine before applying it.
4. THE Backend_Orchestrator SHALL reject any state transition that violates the state machine rules and SHALL return a structured error to the frontend.
5. THE Requirements_Document SHALL explain how the model proposes state changes via structured Step_Transition_Proposals and how the Backend_Orchestrator validates them, ensuring the model is never the authoritative source of workflow state.
6. WHEN an Assembly_Session is interrupted, THE Backend_Orchestrator SHALL persist the full Session_State so that the session can be resumed from the exact point of interruption.

### Requirement 7: Data Contracts and Schemas

**User Story:** As a developer, I want well-defined data contracts and JSON-compatible schemas, so that frontend, backend, and model layers can integrate reliably.

#### Acceptance Criteria

1. THE Requirements_Document SHALL define a Step_Graph schema extracted from manuals, including at minimum: step_id, step_number, title, description, parts_required (list), tools_required (list), prerequisites (list of step_ids), safety_notes (list), expected_visual_cues (list of descriptions and/or diagram references), common_errors (list), completion_checks (list).
2. THE Requirements_Document SHALL define request/response schemas for the following API endpoints: ingest_manual, get_current_step, fetch_step_context, verify_step, propose_step_transition, override_block, flag_warning.
3. THE Requirements_Document SHALL use structured JSON-compatible schema definitions for all data contracts.
4. WHEN a schema field is optional, THE Requirements_Document SHALL explicitly mark it as optional and provide a rationale.
5. THE Requirements_Document SHALL define the Step_Transition_Proposal schema including: proposed_next_step_id, reason, confidence_score, evidence_references, warnings (if any).

### Requirement 8: End-to-End Flows

**User Story:** As a developer, I want documented end-to-end flows for all key user interactions, so that I can implement the correct behavior for each scenario.

#### Acceptance Criteria

1. THE Requirements_Document SHALL describe the following end-to-end flows with step-by-step interaction sequences: (a) First-time project setup, (b) Manual upload and ingestion, (c) Step-graph generation, (d) Starting an assistance session, (e) Asking a clarifying question, (f) Requesting a progress check, (g) Detecting a likely assembly mistake, (h) Handling insufficient visual evidence, (i) Blocking progression, (j) User override of a blocked step, (k) Resuming a session after interruption.
2. WHERE a flow involves interaction between frontend, backend, model, and storage, THE Requirements_Document SHALL include a plain-text sequence diagram showing the interaction order.
3. WHEN the system detects a likely assembly mistake (flow g), THE Backend_Orchestrator SHALL transition the session to BLOCKED state, THE Frontend SHALL display the mismatch reason and expected diagram, and THE Frontend SHALL offer the user the option to override or re-capture evidence.
4. WHEN the system handles insufficient visual evidence (flow h), THE Gemini_Reasoning_Layer SHALL request specific additional camera evidence with guidance on what to capture, and THE Backend_Orchestrator SHALL keep the session in AWAITING_EVIDENCE state.
5. WHEN a user overrides a blocked step (flow j), THE Backend_Orchestrator SHALL record the override with timestamp, user confirmation, the mismatch reason that was overridden, and the confidence score at the time of override.
6. WHEN a session is resumed after interruption (flow k), THE Backend_Orchestrator SHALL restore the full Session_State and THE Frontend SHALL present the user with the step they were on, including any pending warnings or blocked state.

### Requirement 9: Multimodal Reasoning Design

**User Story:** As a developer, I want clear boundaries for what Gemini does directly versus what tools/services handle, so that the system minimizes hallucinated step advancement and maximizes grounding.

#### Acceptance Criteria

1. THE Requirements_Document SHALL specify what the Gemini_Reasoning_Layer does directly: (a) visual comparison of user evidence against manual diagrams, (b) answering clarifying questions grounded in manual content, (c) proposing step transitions as structured output, (d) classifying mismatches, (e) requesting additional evidence when confidence is low.
2. THE Requirements_Document SHALL specify what tools/services outside the model handle: (a) authoritative state management, (b) state transition validation, (c) session persistence, (d) event logging, (e) manual storage and retrieval, (f) confidence thresholding decisions.
3. THE Requirements_Document SHALL describe how manuals, diagrams, user images, and conversation history are combined in prompts to the Gemini_Reasoning_Layer.
4. THE Requirements_Document SHALL describe how to minimize hallucinated step advancement, including: (a) requiring structured JSON output from the model rather than free-form prose, (b) requiring the backend to validate all state transitions, (c) requiring evidence references in every step transition proposal, (d) never advancing state based solely on model prose.
5. WHEN the Gemini_Reasoning_Layer's confidence score for a verification is below a defined threshold, THE Gemini_Reasoning_Layer SHALL request additional camera evidence with specific guidance on what to capture, rather than proposing a step transition.

### Requirement 10: Manual Ingestion Strategy

**User Story:** As a developer, I want a clear strategy for turning a PDF manual into a structured Step_Graph, so that the system can guide assembly from any supported manual.

#### Acceptance Criteria

1. THE Requirements_Document SHALL propose how a PDF/manual becomes a structured Step_Graph, including extraction of: steps, parts, tools, prerequisites, safety notes, expected visual cues, common errors, and completion checks.
2. THE Requirements_Document SHALL describe how diagrams are indexed or cropped for step-level use, producing a Diagram_Index that maps diagram regions to specific steps.
3. IF a manual is low-quality (e.g., poor scan, missing pages, unreadable diagrams), THEN THE Manual_Ingestion layer SHALL return a structured error indicating which parts of the manual could not be processed, rather than producing a partial Step_Graph silently.
4. THE Requirements_Document SHALL describe the ingestion pipeline stages: upload, PDF parsing, text extraction, diagram extraction, step identification, Step_Graph assembly, Diagram_Index generation, quality validation.
5. WHEN the Gemini_Reasoning_Layer is used for step extraction from manuals, THE Backend_Orchestrator SHALL validate the extracted Step_Graph for structural completeness (e.g., no orphan steps, all prerequisites reference valid step_ids) before persisting it.


### Requirement 11: Safety Design

**User Story:** As a product stakeholder, I want a defined soft-warning safety policy for furniture assembly, so that the system warns users about risky progressions without hard-blocking them.

#### Acceptance Criteria

1. THE Requirements_Document SHALL define the soft-warning policy: the system issues warnings but does not permanently prevent the user from proceeding.
2. THE Requirements_Document SHALL clarify what counts as "unsafe progression" in a furniture-only domain, including at minimum: (a) skipping a step that is a prerequisite for a later structural step, (b) proceeding when a mismatch is detected with high confidence, (c) proceeding when evidence is insufficient to confirm correct assembly, (d) proceeding when a part appears to be oriented incorrectly.
3. THE Requirements_Document SHALL define the exact UX when the system cannot confirm safe/accurate progression: (a) the frontend displays a Soft_Warning with the specific reason, (b) the frontend displays the expected diagram alongside the user's evidence, (c) the frontend offers options to re-capture evidence, ask a clarifying question, or override the block.
4. THE Requirements_Document SHALL define how warnings, blocks, and overrides interact: (a) a Soft_Warning does not block progression but is logged, (b) a Blocked_State prevents automatic progression but allows user override, (c) an override of a Blocked_State is recorded with full context (reason, confidence, timestamp, user confirmation), (d) accumulated overrides and warnings are visible in the session summary.
5. THE Safety_Policy_Layer SHALL evaluate every proposed step transition for safety concerns before the Backend_Orchestrator applies it.

### Requirement 12: Evaluation Plan

**User Story:** As a product stakeholder, I want measurable MVP metrics and a lightweight eval dataset strategy, so that the team can assess system quality during and after the hackathon.

#### Acceptance Criteria

1. THE Requirements_Document SHALL define the following measurable MVP metrics: (a) step verification accuracy (percentage of correct verify/reject decisions), (b) false positive mismatch rate (percentage of correct assemblies flagged as mismatches), (c) false negative mismatch rate (percentage of actual mismatches not detected), (d) median user-visible latency for verification requests, (e) successful session resume rate, (f) source-grounding correctness (percentage of model responses traceable to manual content), (g) override frequency (percentage of blocked steps overridden by users).
2. THE Requirements_Document SHALL propose a lightweight eval dataset strategy that a hackathon team can realistically build, including: (a) a small set of real flat-pack manuals (3-5), (b) a set of staged assembly photos at various steps (correct and incorrect), (c) ground-truth labels for step verification, mismatch detection, and step-graph extraction, (d) a method for running automated eval passes against the dataset.
3. THE Requirements_Document SHALL define target ranges or baselines for each metric where feasible, acknowledging that initial baselines may be established during the hackathon.

### Requirement 13: Milestone Plan

**User Story:** As a project lead, I want a phased implementation plan with a minimum demoable milestone and stretch goals, so that the team can prioritize work effectively.

#### Acceptance Criteria

1. THE Requirements_Document SHALL break implementation into at least three phases: (a) Phase 1 — minimum demoable milestone, (b) Phase 2 — full v1 feature set, (c) Phase 3 — stretch goals and production hardening.
2. THE Requirements_Document SHALL identify the minimum demoable milestone as: single manual upload, step-graph extraction, at least 3 steps of guided assembly with evidence capture and verification, basic mismatch detection, and session state display.
3. THE Requirements_Document SHALL identify optional stretch goals including at minimum: (a) Live API evaluation for lower-latency streaming interactions, (b) multi-manual support, (c) richer mismatch explanations with annotated images, (d) session analytics dashboard, (e) Vertex AI backend abstraction swap.
4. THE Requirements_Document SHALL indicate where Live API integration would fit as a stretch goal, specifying the phase and the conditions under which it should be evaluated.

### Requirement 14: Open Questions

**User Story:** As a product stakeholder, I want all unresolved decisions listed explicitly, so that the team does not make assumptions where requirements are unspecified.

#### Acceptance Criteria

1. THE Requirements_Document SHALL list all unresolved decisions as explicit open questions, without answering them with guesses.
2. THE Requirements_Document SHALL categorize open questions by area (e.g., product, technical, safety, evaluation).
3. THE Requirements_Document SHALL include at minimum the following open question areas: (a) confidence threshold values for verification and blocking, (b) maximum supported manual size/page count, (c) supported manual languages, (d) image resolution and format requirements for evidence capture, (e) session timeout and expiration policy, (f) rate limiting and abuse prevention, (g) data retention and privacy policy for uploaded manuals and images, (h) accessibility requirements for the frontend, (i) authentication and user identity model, (j) deployment target and infrastructure choices.
4. THE Requirements_Document SHALL NOT contain invented answers for any open question; each question SHALL be stated as a decision point requiring stakeholder input.

### Requirement 15: Observability, Replayability, and Testability

**User Story:** As a developer, I want the system designed for observability, replayability, and testability, so that issues can be diagnosed, sessions can be replayed, and components can be tested in isolation.

#### Acceptance Criteria

1. THE Backend_Orchestrator SHALL log every state transition, model request/response, evidence submission, warning, block, and override as structured events with timestamps and correlation IDs.
2. THE Event_Log SHALL be sufficient to replay any Assembly_Session from start to finish, reproducing the exact sequence of state transitions and model interactions.
3. THE Requirements_Document SHALL describe how each system component (frontend, backend, model orchestration, ingestion, verification, safety) can be tested in isolation with mock dependencies.
4. WHEN a model request is logged, THE Event_Log SHALL include the full prompt context (or a reference to it) and the full structured response, enabling offline analysis and regression testing.
5. THE Requirements_Document SHALL describe how the eval dataset (Requirement 12) integrates with the testability strategy to enable automated regression testing of verification accuracy.

### Requirement 16: Latency and Performance

**User Story:** As a user, I want the system to respond quickly enough that assembly guidance feels interactive, so that I am not waiting excessively between steps.

#### Acceptance Criteria

1. THE Requirements_Document SHALL define latency targets for key interactions: (a) evidence verification response, (b) clarifying question response, (c) step-graph generation from manual, (d) session resume.
2. THE Requirements_Document SHALL identify which interactions are latency-sensitive (verification, Q&A) versus latency-tolerant (manual ingestion, step-graph generation).
3. IF a latency-sensitive interaction exceeds the target latency, THEN THE Frontend SHALL display a loading indicator with contextual messaging (e.g., "Checking your progress...").
4. THE Requirements_Document SHALL note that specific latency target values are open questions to be baselined during the hackathon (cross-reference Requirement 14).

### Requirement 17: API Abstraction and Future Portability

**User Story:** As a developer, I want the Gemini API integration behind a backend abstraction, so that the system can later target Vertex AI or other providers without rewriting the orchestration layer.

#### Acceptance Criteria

1. THE Model_Orchestration_Layer SHALL access the Gemini Developer API through a backend abstraction interface, not directly from the frontend.
2. THE backend abstraction interface SHALL be designed so that swapping from Gemini Developer API to Vertex AI requires changes only in the adapter implementation, not in the orchestration logic or data contracts.
3. THE Requirements_Document SHALL describe the abstraction boundary: what is provider-specific (API authentication, endpoint URLs, request formatting) versus provider-agnostic (prompt construction, structured output parsing, confidence thresholding).
