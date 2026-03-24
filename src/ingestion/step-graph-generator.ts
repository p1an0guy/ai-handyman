import { v4 as uuidv4 } from 'uuid';
import type { StepGraph, DiagramIndex } from '../models/index.js';
import type { ModelOrchestrationLayer } from '../ai/model-orchestration.js';
import type { ManualContent } from '../storage/interfaces.js';

export interface StepGraphValidationResult {
  valid: boolean;
  errors: Array<{ code: string; message: string }>;
}

export class StepGraphGenerator {
  constructor(private readonly modelLayer: ModelOrchestrationLayer) {}

  async generate(manual: ManualContent): Promise<StepGraph> {
    return this.modelLayer.extractStepGraph(manual);
  }
}

export class DiagramIndexer {
  buildIndex(manualId: string, stepGraph: StepGraph, diagrams: Array<{ pageNumber: number; description: string; imageData?: string }>): DiagramIndex {
    const entries = stepGraph.steps.map((step, i) => {
      const diagram = diagrams[i] ?? diagrams[0];
      return {
        diagram_id: uuidv4(),
        step_id: step.step_id,
        page_number: diagram?.pageNumber ?? i + 1,
        bounding_box: { x: 0, y: 0, width: 400, height: 300 },
        image_ref: diagram?.imageData ?? `diagram-${step.step_id}`,
        description: diagram?.description,
      };
    });
    return { manual_id: manualId, entries };
  }
}

export function validateStepGraph(stepGraph: StepGraph): StepGraphValidationResult {
  const errors: Array<{ code: string; message: string }> = [];
  const stepIds = new Set(stepGraph.steps.map(s => s.step_id));

  for (let i = 0; i < stepGraph.steps.length; i++) {
    if (stepGraph.steps[i].step_number !== i + 1) {
      errors.push({ code: 'NON_SEQUENTIAL', message: `Step at index ${i} has step_number ${stepGraph.steps[i].step_number}, expected ${i + 1}` });
    }
  }

  for (const step of stepGraph.steps) {
    for (const prereq of step.prerequisites) {
      if (!stepIds.has(prereq)) {
        errors.push({ code: 'INVALID_PREREQUISITE', message: `Step ${step.step_id} references non-existent prerequisite ${prereq}` });
      }
    }
  }

  if (stepGraph.steps.length > 1) {
    const reachable = new Set<string>();
    const queue = [stepGraph.steps[0].step_id];
    reachable.add(stepGraph.steps[0].step_id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const step of stepGraph.steps) {
        if (!reachable.has(step.step_id) && step.prerequisites.includes(current)) {
          reachable.add(step.step_id);
          queue.push(step.step_id);
        }
      }
      const currentStep = stepGraph.steps.find(s => s.step_id === current);
      if (currentStep) {
        const nextStep = stepGraph.steps.find(s => s.step_number === currentStep.step_number + 1);
        if (nextStep && !reachable.has(nextStep.step_id)) {
          reachable.add(nextStep.step_id);
          queue.push(nextStep.step_id);
        }
      }
    }
    for (const step of stepGraph.steps) {
      if (!reachable.has(step.step_id)) {
        errors.push({ code: 'ORPHAN_STEP', message: `Step ${step.step_id} is unreachable from the first step` });
      }
    }
  }

  if (stepGraph.total_steps !== stepGraph.steps.length) {
    errors.push({ code: 'COUNT_MISMATCH', message: `total_steps (${stepGraph.total_steps}) does not match actual step count (${stepGraph.steps.length})` });
  }

  return { valid: errors.length === 0, errors };
}
