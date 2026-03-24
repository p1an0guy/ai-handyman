import { describe, it, expect } from 'vitest';
import { validateStepGraph } from './step-graph-generator.js';
import { sampleStepGraph } from '../fixtures/index.js';
import type { StepGraph } from '../models/index.js';

describe('validateStepGraph', () => {
  it('validates a correct step graph', () => {
    const result = validateStepGraph(sampleStepGraph);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects non-sequential step numbers', () => {
    const bad: StepGraph = { ...sampleStepGraph, steps: sampleStepGraph.steps.map((s, i) => ({ ...s, step_number: i + 10 })) };
    const result = validateStepGraph(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'NON_SEQUENTIAL')).toBe(true);
  });

  it('detects invalid prerequisite references', () => {
    const bad: StepGraph = { ...sampleStepGraph, steps: sampleStepGraph.steps.map(s => ({ ...s, prerequisites: ['non-existent'] })) };
    const result = validateStepGraph(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'INVALID_PREREQUISITE')).toBe(true);
  });

  it('detects total_steps count mismatch', () => {
    const bad: StepGraph = { ...sampleStepGraph, total_steps: 99 };
    const result = validateStepGraph(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'COUNT_MISMATCH')).toBe(true);
  });
});
