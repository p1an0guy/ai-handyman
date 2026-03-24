import type { StepGraph, DiagramIndex } from '../models/index.js';
import type { ManualStore, ManualContent } from './interfaces.js';

export class InMemoryManualStore implements ManualStore {
  private manuals = new Map<string, ManualContent>();
  private stepGraphs = new Map<string, StepGraph>();
  private diagramIndices = new Map<string, DiagramIndex>();

  async save(manual: ManualContent, stepGraph: StepGraph, diagramIndex: DiagramIndex): Promise<void> {
    this.manuals.set(manual.manual_id, manual);
    this.stepGraphs.set(manual.manual_id, stepGraph);
    this.diagramIndices.set(manual.manual_id, diagramIndex);
  }

  async getManual(manualId: string): Promise<ManualContent | null> {
    return this.manuals.get(manualId) ?? null;
  }

  async getStepGraph(manualId: string): Promise<StepGraph | null> {
    return this.stepGraphs.get(manualId) ?? null;
  }

  async getDiagramIndex(manualId: string): Promise<DiagramIndex | null> {
    return this.diagramIndices.get(manualId) ?? null;
  }
}
