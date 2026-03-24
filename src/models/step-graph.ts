export type Part = { part_id: string; name: string; quantity: number };
export type Tool = { tool_id: string; name: string };
export type VisualCue = { description: string; diagram_ref?: string };
export type CommonError = { error_type: string; description: string; visual_indicator?: string };
export type CompletionCheck = { check_id: string; description: string; verification_type: 'visual' | 'structural' | 'count' };
export type Step = { step_id: string; step_number: number; title: string; description: string; parts_required: Part[]; tools_required: Tool[]; prerequisites: string[]; safety_notes: string[]; expected_visual_cues: VisualCue[]; common_errors: CommonError[]; completion_checks: CompletionCheck[] };
export type StepGraph = { manual_id: string; version: string; total_steps: number; steps: Step[] };
