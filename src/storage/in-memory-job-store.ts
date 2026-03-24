import type { IngestionJob } from '../models/index.js';
import type { JobStore } from './interfaces.js';

export class InMemoryJobStore implements JobStore {
  private store = new Map<string, IngestionJob>();

  async save(job: IngestionJob): Promise<void> {
    this.store.set(job.job_id, job);
  }

  async load(jobId: string): Promise<IngestionJob | null> {
    return this.store.get(jobId) ?? null;
  }

  async update(job: IngestionJob): Promise<void> {
    if (!this.store.has(job.job_id)) {
      throw new Error(`Job not found: ${job.job_id}`);
    }
    this.store.set(job.job_id, job);
  }
}
