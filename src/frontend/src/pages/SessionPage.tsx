import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { ErrorDisplay, SessionControls, ProgressBar, CameraCapture, StepDisplay, VerificationResult } from '../components';
import { ChatPanel } from '../components/ChatPanel';
import type { CurrentStepResponse, VerifyStepResponse } from '../api-types';

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as { error?: { code?: string; message?: string; details?: { current_state?: string; attempted_transition?: string } } };
    if (maybeError.error?.code === 'INVALID_TRANSITION') {
      const details = maybeError.error.details;
      const parts = [maybeError.error.message];
      if (details?.current_state) parts.push(`Current state: ${details.current_state}`);
      if (details?.attempted_transition) parts.push(`Attempted: ${details.attempted_transition}`);
      return parts.join('. ');
    }
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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<(() => void) | null>(null);

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
    setCapturedImage(imageData);
    setLastAction(() => () => handleCapture(imageData));
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
      setCapturedImage(null);
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
      setCapturedImage(null);
      await loadSession();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Advance failed'));
    }
  }

  function handleRetry() {
    setError(null);
    if (lastAction) lastAction();
  }

  const lifecycleState = session?.session_lifecycle_state ?? '';
  const isPausedOrComplete = lifecycleState === 'SESSION_PAUSED' || lifecycleState === 'SESSION_COMPLETE';
  const blockedState = stepContext?.blocked_state;
  const activeWarnings = stepContext?.active_warnings ?? [];

  // Build diagram URL from step's visual cues
  const diagramRef = stepContext?.step?.expected_visual_cues.find(c => c.diagram_ref)?.diagram_ref;
  const diagramUrl = diagramRef ? `/api/images/${diagramRef}` : undefined;

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <ErrorDisplay error={error} onDismiss={() => setError(null)} onRetry={handleRetry} />
      <SessionControls
        state={lifecycleState}
        onPause={pauseSession}
        onResume={resumeSession}
      />
      {stepContext && (
        <ProgressBar completed={stepContext.progress.completed} total={stepContext.progress.total} />
      )}

      {activeWarnings.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          {activeWarnings.map((w) => (
            <div key={w.warning_id} style={{
              padding: '8px 12px', background: '#fff3e0', border: '1px solid #ffb74d',
              borderRadius: '4px', marginBottom: '4px', fontSize: '0.9em',
            }}>
              <strong>{w.type.replace('_', ' ')}:</strong> {w.message}
            </div>
          ))}
        </div>
      )}

      {blockedState?.is_blocked && !verifyResult && (
        <div style={{
          padding: '12px', background: '#ffebee', border: '1px solid #ef5350',
          borderRadius: '8px', marginBottom: '10px',
        }}>
          <p style={{ margin: '0 0 8px', fontWeight: 'bold', color: '#c62828' }}>Step Blocked</p>
          {blockedState.reason && <p style={{ margin: '0 0 4px' }}>{blockedState.reason}</p>}
          {blockedState.mismatch_classification && (
            <p style={{ margin: '0 0 4px', fontSize: '0.85em', color: '#666' }}>
              Mismatch type: {blockedState.mismatch_classification}
            </p>
          )}
          {blockedState.confidence_score != null && (
            <p style={{ margin: '0 0 8px', fontSize: '0.85em', color: '#666' }}>
              Confidence: {Math.round(blockedState.confidence_score * 100)}%
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleOverride}>Override Block</button>
            <button onClick={() => { setVerifyResult(null); setCapturedImage(null); }}>Re-capture Evidence</button>
          </div>
        </div>
      )}

      <StepDisplay step={stepContext?.step ?? null} diagramUrl={diagramUrl} />
      <VerificationResult
        result={verifyResult}
        capturedImage={capturedImage ?? undefined}
        onOverride={handleOverride}
        onReCapture={() => { setVerifyResult(null); setCapturedImage(null); }}
        onAdvance={handleAdvance}
      />
      {!isPausedOrComplete && (
        <CameraCapture onCapture={handleCapture} disabled={!stepContext?.step} />
      )}
      <ChatPanel sessionId={sessionId!} currentStepId={stepContext?.step?.step_id} />
    </div>
  );
}
