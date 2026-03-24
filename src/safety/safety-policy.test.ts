import { describe, it, expect } from 'vitest';
import { evaluateTransition } from './safety-policy.js';
import { sampleStepGraph, createSampleSession } from '../fixtures/index.js';
import type { StepTransitionProposal } from '../models/index.js';

function makeProposal(overrides: Partial<StepTransitionProposal> = {}): StepTransitionProposal {
  return {
    proposal_id: 'p1', session_id: 's1', current_step_id: 'step-1',
    proposed_next_step_id: 'step-1', reason: 'test', confidence_score: 0.9,
    evidence_references: [], warnings: [], mismatch_detected: false, mismatch_details: {},
    ...overrides,
  };
}

describe('SafetyPolicy', () => {
  it('passes clean transitions', () => {
    const session = createSampleSession();
    const result = evaluateTransition(makeProposal(), session, sampleStepGraph);
    expect(result.result).toBe('pass');
    expect(result.warnings).toHaveLength(0);
  });

  it('blocks high-confidence mismatches', () => {
    const session = createSampleSession();
    const result = evaluateTransition(makeProposal({ mismatch_detected: true, confidence_score: 0.85 }), session, sampleStepGraph);
    expect(result.result).toBe('block');
    expect(result.block_reason).toBeDefined();
  });

  it('warns on low-confidence mismatches', () => {
    const session = createSampleSession();
    const result = evaluateTransition(makeProposal({ mismatch_detected: true, confidence_score: 0.5 }), session, sampleStepGraph);
    expect(result.result).toBe('soft_warning');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('detects prerequisite violations', () => {
    const session = createSampleSession();
    // step-3 requires step-1 and step-2, but neither completed
    const result = evaluateTransition(makeProposal({ proposed_next_step_id: 'step-3' }), session, sampleStepGraph);
    expect(result.prerequisite_violations.length).toBeGreaterThan(0);
  });

  it('treats the current step as completed when evaluating the next step', () => {
    const session = createSampleSession();
    const result = evaluateTransition(makeProposal({ current_step_id: 'step-1', proposed_next_step_id: 'step-2' }), session, sampleStepGraph);
    expect(result.result).toBe('pass');
    expect(result.prerequisite_violations).toHaveLength(0);
  });

  it('warns on low confidence without mismatch', () => {
    const session = createSampleSession();
    const result = evaluateTransition(makeProposal({ confidence_score: 0.3 }), session, sampleStepGraph);
    expect(result.result).toBe('soft_warning');
    expect(result.warnings.some(w => w.type === 'low_confidence')).toBe(true);
  });
});
