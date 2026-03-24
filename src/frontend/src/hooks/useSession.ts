import { useState, useCallback } from 'react';

interface SessionInfo {
  session_id: string;
  resume_token: string;
  session_lifecycle_state: string;
  step_workflow_state: string;
  state: string;
}

export function useSession(sessionId: string) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/session/${sessionId}/current_step`);
      if (!res.ok) throw await res.json();
      const data = await res.json();
      setSession(prev => ({ ...prev, session_id: sessionId, resume_token: prev?.resume_token ?? '', ...data }));
    } catch (e: any) {
      setError(e?.error?.message ?? 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const pauseSession = useCallback(async () => {
    const token = localStorage.getItem(`resume_token_${sessionId}`);
    if (!token) { setError('No resume token found'); return; }
    try {
      const res = await fetch(`/api/session/${sessionId}/pause`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_token: token }),
      });
      if (!res.ok) throw await res.json();
      const data = await res.json();
      setSession(prev => prev ? { ...prev, ...data } : null);
    } catch (e: any) {
      setError(e?.error?.message ?? 'Failed to pause');
    }
  }, [sessionId]);

  const resumeSession = useCallback(async () => {
    const token = localStorage.getItem(`resume_token_${sessionId}`);
    if (!token) { setError('No resume token found'); return; }
    try {
      const res = await fetch(`/api/session/${sessionId}/resume`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_token: token }),
      });
      if (!res.ok) throw await res.json();
      const data = await res.json();
      setSession(prev => prev ? { ...prev, ...data } : null);
    } catch (e: any) {
      setError(e?.error?.message ?? 'Failed to resume');
    }
  }, [sessionId]);

  return { session, loading, error, loadSession, pauseSession, resumeSession, setSession, setError };
}
