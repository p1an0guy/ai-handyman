import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { CreateSessionResponse, IngestionJobResponse, StartSessionResponse } from '../api-types';

const resumeTokenKey = (sessionId: string) => `resume_token_${sessionId}`;

export function IngestionPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<IngestionJobResponse | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`/api/ingestion_jobs/${jobId}`);
        if (!res.ok) throw new Error(`API error ${res.status}`);
        setJob((await res.json()) as IngestionJobResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Poll failed');
      }
    }
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [jobId]);

  async function startAssembly() {
    if (!job?.manual_id || starting) return;
    setStarting(true);
    setError('');
    try {
      const createRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual_id: job.manual_id }),
      });
      if (!createRes.ok) throw new Error(`API error ${createRes.status}`);
      const created = (await createRes.json()) as CreateSessionResponse;
      localStorage.setItem(resumeTokenKey(created.session_id), created.resume_token);

      const startRes = await fetch(`/api/session/${created.session_id}/start`, {
        method: 'POST',
      });
      if (!startRes.ok) throw new Error(`API error ${startRes.status}`);
      await startRes.json() as StartSessionResponse;
      navigate(`/session/${created.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setStarting(false);
    }
  }

  async function retry() {
    try {
      const res = await fetch(`/api/ingestion_jobs/${jobId}/resume`, { method: 'POST' });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      setJob((await res.json()) as IngestionJobResponse);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    }
  }

  if (error) return <div><p style={{ color: 'red' }}>{error}</p></div>;
  if (!job) return <div><p>Loading...</p></div>;

  return (
    <div>
      <h1>Processing Manual</h1>
      <p>Job: {job.job_id}</p>
      <p>Status: {job.status}</p>
      <p>Stage: {job.stage}</p>
      <p>Progress: {job.progress_percent}%</p>
      <progress value={job.progress_percent} max={100} />
      {job.status === 'complete' && (
        <div>
          <p>✓ Processing complete</p>
          <button onClick={startAssembly} disabled={starting}>
            {starting ? 'Starting...' : 'Start Assembly'}
          </button>
        </div>
      )}
      {(job.status === 'error' || job.status === 'awaiting_retry') && (
        <div>
          {job.errors.map((jobError, index) => (
            <p key={`${jobError.code}-${index}`} style={{ color: 'red' }}>
              Error: {jobError.message}
            </p>
          ))}
          <button onClick={retry}>Retry</button>
        </div>
      )}
    </div>
  );
}
