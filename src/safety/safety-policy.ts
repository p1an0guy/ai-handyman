import { v4 as uuidv4 } from 'uuid';
import type { StepTransitionProposal, SessionState, StepGraph, SafetyEvaluation, Warning } from '../models/index.js';

export function evaluateTransition(
  proposal: StepTransitionProposal,
  sessionState: SessionState,
  stepGraph: StepGraph,
): SafetyEvaluation {
  const warnings: Warning[] = [];
  const prerequisiteViolations: string[] = [];
  let result: 'pass' | 'soft_warning' | 'block' = 'pass';
  let blockReason: string | undefined;
  const now = new Date().toISOString();

  // 1. Check prerequisite violations
  const nextStep = stepGraph.steps.find(s => s.step_id === proposal.proposed_next_step_id);
  if (nextStep) {
    const completedIds = new Set(sessionState.completed_steps.map(c => c.step_id));
    const overriddenIds = new Set(sessionState.overrides.map(o => o.step_id));
    for (const prereq of nextStep.prerequisites) {
      if (!completedIds.has(prereq) && !overriddenIds.has(prereq)) {
        prerequisiteViolations.push(prereq);
        warnings.push({
          warning_id: uuidv4(),
          step_id: proposal.current_step_id,
          type: 'prerequisite_skip',
          message: `Prerequisite step ${prereq} has not been completed`,
          issued_at: now,
        });
      }
    }
  }

  // 2. Check high-confidence mismatch -> BLOCK
  if (proposal.mismatch_detected && proposal.confidence_score >= 0.7) {
    result = 'block';
    blockReason = proposal.mismatch_details?.description ?? 'High-confidence mismatch detected';
  }

  // 3. Check low-confidence mismatch -> soft warning
  if (proposal.mismatch_detected && proposal.confidence_score < 0.7) {
    if (result !== 'block') result = 'soft_warning';
    warnings.push({
      warning_id: uuidv4(),
      step_id: proposal.current_step_id,
      type: 'mismatch',
      message: proposal.mismatch_details?.description ?? 'Possible mismatch detected',
      issued_at: now,
    });
  }

  // 4. Check orientation issues from proposal warnings
  const orientationWarnings = proposal.warnings.filter(w => w.type.toLowerCase().includes('orientation'));
  for (const ow of orientationWarnings) {
    warnings.push({
      warning_id: uuidv4(),
      step_id: proposal.current_step_id,
      type: 'orientation',
      message: ow.message,
      issued_at: now,
    });
    if (result === 'pass') result = 'soft_warning';
  }

  // 5. Check low confidence without mismatch -> soft warning
  if (!proposal.mismatch_detected && proposal.confidence_score < 0.5) {
    warnings.push({
      warning_id: uuidv4(),
      step_id: proposal.current_step_id,
      type: 'low_confidence',
      message: `Low verification confidence: ${Math.round(proposal.confidence_score * 100)}%`,
      issued_at: now,
    });
    if (result === 'pass') result = 'soft_warning';
  }

  // 6. Prerequisite violations with structural steps -> BLOCK
  if (prerequisiteViolations.length > 0) {
    const structuralPrereqs = prerequisiteViolations.filter(prereqId => {
      return stepGraph.steps.some(s =>
        s.step_id !== nextStep?.step_id && s.prerequisites.includes(prereqId)
      );
    });
    if (structuralPrereqs.length > 0) {
      result = 'block';
      blockReason = `Skipping structural prerequisite(s): ${structuralPrereqs.join(', ')}`;
    } else if (result === 'pass') {
      result = 'soft_warning';
    }
  }

  return { result, warnings, block_reason: blockReason, prerequisite_violations: prerequisiteViolations };
}
