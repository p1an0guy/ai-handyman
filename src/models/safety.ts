import type { Warning } from './session.js';

export type SafetyResult = 'pass' | 'soft_warning' | 'block';
export type SafetyEvaluation = { result: SafetyResult; warnings: Warning[]; block_reason?: string; prerequisite_violations: string[] };
export type MismatchType = 'wrong_part' | 'wrong_orientation' | 'missing_part' | 'incomplete_step' | 'other';
export type MismatchClassification = { type: MismatchType; description: string; confidence_score: number };
