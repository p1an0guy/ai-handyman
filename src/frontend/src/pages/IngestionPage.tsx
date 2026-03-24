import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface JobStatus {
  job_id: string;
  status: string;
  stage: string;
  progress_percent: number;
  manual_id?: string;
  error?: string;
}

export function IngestionPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`/api/ingestion_jobs/${jobId}`);
        if (!res.ok) throw new Error(`API error ${res.status}`);
        setJob(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Poll failed');
      }
    }
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [jobId]);

  async function startAssembly() {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manual_id: job?.manual_id }),
    });
    const data = await res.json();
    navigate(`/session/${data.session_id}`);
  }

  async function retry() {
    await fetch(`/api/ingestion_jobs/${jobId}/resume`, { method: 'POST' });
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
          <button onClick={startAssembly}>Start Assembly</button>
        </div>
      )}
      {job.status === 'error' && (
        <div>
          <p style={{ color: 'red' }}>Error: {job.error}</p>
          <button onClick={retry}>Retry</button>
        </div>
      )}
    </div>
  );
}
