import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { ErrorDisplay, SessionControls, ProgressBar, CameraCapture, StepDisplay, VerificationResult } from '../components';
import { ChatPanel } from '../components/ChatPanel';
import type { CurrentStepResponse, VerifyStepResponse } from '../api-types';

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as { error?: { message?: string } };
    if (maybeError.error?.message) {
      return maybeError.error.message;
    }
  }
  return fallback;
}

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { session, error, loadSession, pauseSession, resumeSession, setError } = useSession(sessionId!);
  const [stepContext, setStepContext] = useState<CurrentStepResponse | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyStepResponse | null>(null);

  const fetchStepContext = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${sessionId}/step_context`);
      if (!res.ok) throw await res.json();
      setStepContext((await res.json()) as CurrentStepResponse);
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to load step context'));
    }
  }, [sessionId, setError]);

  useEffect(() => {
    loadSession().then(() => fetchStepContext());
  }, [fetchStepContext, loadSession]);

  useEffect(() => {
    if (session?.step_workflow_state) fetchStepContext();
  }, [fetchStepContext, session?.step_workflow_state]);

  async function handleCapture(imageData: string) {
    if (!stepContext?.step) return;
    try {
      const res = await fetch(`/api/session/${sessionId}/verify_step`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_id: stepContext.step.step_id, evidence_image: imageData }),
      });
      if (!res.ok) throw await res.json();
      setVerifyResult((await res.json()) as VerifyStepResponse);
      await loadSession();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Verification failed'));
    }
  }

  async function handleOverride() {
    if (!stepContext?.step) return;
    try {
      const res = await fetch(`/api/session/${sessionId}/override`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_id: stepContext.step.step_id, user_confirmation: true }),
      });
      if (!res.ok) throw await res.json();
      setVerifyResult(null);
      await loadSession();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Override failed'));
    }
  }

  async function handleAdvance() {
    try {
      const res = await fetch(`/api/session/${sessionId}/advance`, { method: 'POST' });
      if (!res.ok) throw await res.json();
      setVerifyResult(null);
      await loadSession();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Advance failed'));
    }
  }

  const lifecycleState = session?.session_lifecycle_state ?? '';
  const isPausedOrComplete = lifecycleState === 'SESSION_PAUSED' || lifecycleState === 'SESSION_COMPLETE';

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <ErrorDisplay error={error} onDismiss={() => setError(null)} />
      <SessionControls
        state={lifecycleState}
        onPause={pauseSession}
        onResume={resumeSession}
      />
      {stepContext && (
        <ProgressBar completed={stepContext.progress.completed} total={stepContext.progress.total} />
      )}
      <StepDisplay step={stepContext?.step ?? null} />
      <VerificationResult
        result={verifyResult}
        onOverride={handleOverride}
        onReCapture={() => setVerifyResult(null)}
        onAdvance={handleAdvance}
      />
      {!isPausedOrComplete && (
        <CameraCapture onCapture={handleCapture} disabled={!stepContext?.step} />
      )}
      <ChatPanel sessionId={sessionId!} currentStepId={stepContext?.step?.step_id} />
    </div>
  );
}
