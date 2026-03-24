import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IngestManualResponse } from '../api-types';

export function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > 50 * 1024 * 1024) {
      setError('File exceeds 50MB limit');
      setFile(null);
    } else {
      setError('');
      setFile(f);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/ingest_manual', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = (await res.json()) as IngestManualResponse;
      navigate(`/ingestion/${data.job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Upload Manual</h1>
      <form onSubmit={handleSubmit}>
        <input type="file" accept=".pdf" onChange={handleFile} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <br />
        <button type="submit" disabled={!file || loading}>
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
    </div>
  );
}
