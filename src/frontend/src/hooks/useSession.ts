import { useState, useCallback } from 'react';

interface SessionInfo {
  session_id: string;
  session_lifecycle_state: string;
  step_workflow_state: string;
  state: string;
}

const resumeTokenKey = (sessionId: string) => `resume_token_${sessionId}`;

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as { error?: { message?: string } };
    if (maybeError.error?.message) {
      return maybeError.error.message;
    }
  }
  return fallback;
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
      setSession({ session_id: sessionId, ...data });
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to load session'));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const handleResumeTokenError = useCallback((err: { error?: { code?: string; message?: string } } | null | undefined) => {
    if (err?.error?.code === 'INVALID_RESUME_TOKEN') {
      localStorage.removeItem(resumeTokenKey(sessionId));
      setError('Resume token is invalid or expired. Start a new session from the upload flow.');
      return true;
    }
    return false;
  }, [sessionId]);

  const pauseSession = useCallback(async () => {
    const token = localStorage.getItem(resumeTokenKey(sessionId));
    if (!token) { setError('No resume token found'); return; }
    try {
      const res = await fetch(`/api/session/${sessionId}/pause`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_token: token }),
      });
      if (!res.ok) throw await res.json();
      const data = await res.json();
      setSession(prev => prev ? { ...prev, ...data } : null);
    } catch (error: unknown) {
      if (handleResumeTokenError(error as { error?: { code?: string; message?: string } })) return;
      setError(getErrorMessage(error, 'Failed to pause'));
    }
  }, [handleResumeTokenError, sessionId]);

  const resumeSession = useCallback(async () => {
    const token = localStorage.getItem(resumeTokenKey(sessionId));
    if (!token) { setError('No resume token found'); return; }
    try {
      const res = await fetch(`/api/session/${sessionId}/resume`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_token: token }),
      });
      if (!res.ok) throw await res.json();
      const data = await res.json();
      setSession(prev => prev ? { ...prev, ...data } : null);
    } catch (error: unknown) {
      if (handleResumeTokenError(error as { error?: { code?: string; message?: string } })) return;
      setError(getErrorMessage(error, 'Failed to resume'));
    }
  }, [handleResumeTokenError, sessionId]);

  return { session, loading, error, loadSession, pauseSession, resumeSession, setSession, setError };
}
