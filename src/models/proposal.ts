export type ProposalWarning = { type: string; message: string };
export type MismatchDetails = { type?: string; description?: string; visual_indicator?: string };
export type StepTransitionProposal = { proposal_id: string; session_id: string; current_step_id: string; proposed_next_step_id: string; reason: string; confidence_score: number; evidence_references: string[]; warnings: ProposalWarning[]; mismatch_detected: boolean; mismatch_details: MismatchDetails };
