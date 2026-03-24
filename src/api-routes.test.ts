import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import app, { deps } from './server.js';
import { sampleDiagramIndex, sampleStepGraph } from './fixtures/index.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('API routes', () => {
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll(async () => {
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('creates a session without auto-starting it, then starts it explicitly', async () => {
    const manualId = `manual-api-${crypto.randomUUID()}`;
    await deps.manualStore.save(
      { manual_id: manualId, raw_text: 'API manual', page_images: [] },
      { ...sampleStepGraph, manual_id: manualId },
      { ...sampleDiagramIndex, manual_id: manualId },
    );

    const createRes = await fetch(`${baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manual_id: manualId }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as {
      session_id: string;
      resume_token: string;
      session_lifecycle_state: string;
      step_workflow_state: string;
    };
    expect(created.resume_token).toBeTruthy();
    expect(created.session_lifecycle_state).toBe('NOT_STARTED');
    expect(created.step_workflow_state).toBe('IN_PROGRESS');

    const startRes = await fetch(`${baseUrl}/session/${created.session_id}/start`, {
      method: 'POST',
    });
    expect(startRes.status).toBe(200);
    const started = await startRes.json() as {
      session_lifecycle_state: string;
      step_workflow_state: string;
    };
    expect(started.session_lifecycle_state).toBe('ACTIVE');
    expect(started.step_workflow_state).toBe('AWAITING_EVIDENCE');
  });

  it('accepts multipart manual uploads and completes ingestion asynchronously', async () => {
    const formData = new FormData();
    formData.append('file', new Blob([Buffer.from('%PDF-1.4 fake content')], { type: 'application/pdf' }), 'manual.pdf');

    const ingestRes = await fetch(`${baseUrl}/ingest_manual`, {
      method: 'POST',
      body: formData,
    });
    expect(ingestRes.status).toBe(202);
    const created = await ingestRes.json() as { job_id: string; status_url: string };

    let status = 'queued';
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const jobRes = await fetch(`${baseUrl}${created.status_url}`);
      expect(jobRes.status).toBe(200);
      const job = await jobRes.json() as { status: string; result: { manual_id?: string }; errors: Array<{ message: string }> };
      status = job.status;
      if (status === 'complete') {
        expect(job.result.manual_id).toBeTruthy();
        return;
      }
      if (status === 'error') {
        throw new Error(`Expected ingestion to complete, got error: ${job.errors.map((error) => error.message).join(', ')}`);
      }
      await sleep(25);
    }

    throw new Error(`Ingestion job did not complete, final status was ${status}`);
  });
});
