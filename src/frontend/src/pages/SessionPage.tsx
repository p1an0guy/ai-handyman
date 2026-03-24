import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { ErrorDisplay, SessionControls, ProgressBar, CameraCapture, StepDisplay, VerificationResult } from '../components';
import { ChatPanel } from '../components/ChatPanel';

interface StepContext {
  step: {
    step_id: string;
    step_number: number;
    title: string;
    description: string;
    parts_required: string[];
    tools_required: string[];
    safety_notes: string[];
    expected_visual_cues: string[];
  } | null;
  progress: { completed: number; total: number; percentage: number };
}

interface VerificationResultData {
  verification_result: 'pass' | 'fail' | 'insufficient';
  confidence_score: number;
  mismatch?: string;
  additional_evidence_request?: string;
  warnings?: string[];
}

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { session, error, loadSession, pauseSession, resumeSession, setError } = useSession(sessionId!);
  const [stepContext, setStepContext] = useState<StepContext | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerificationResultData | null>(null);

  async function fetchStepContext() {
    try {
      const res = await fetch(`/api/session/${sessionId}/step_context`);
      if (!res.ok) throw await res.json();
      setStepContext(await res.json());
    } catch (e: any) {
      setError(e?.error?.message ?? 'Failed to load step context');
    }
  }

  useEffect(() => {
    loadSession().then(() => fetchStepContext());
  }, []);

  useEffect(() => {
    if (session?.step_workflow_state) fetchStepContext();
  }, [session?.step_workflow_state]);

  async function handleCapture(imageData: string) {
    if (!stepContext?.step) return;
    try {
      const res = await fetch(`/api/session/${sessionId}/verify_step`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_id: stepContext.step.step_id, evidence_image: imageData }),
      });
      if (!res.ok) throw await res.json();
      setVerifyResult(await res.json());
      await loadSession();
    } catch (e: any) {
      setError(e?.error?.message ?? 'Verification failed');
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
    } catch (e: any) {
      setError(e?.error?.message ?? 'Override failed');
    }
  }

  async function handleAdvance() {
    try {
      const res = await fetch(`/api/session/${sessionId}/advance`, { method: 'POST' });
      if (!res.ok) throw await res.json();
      setVerifyResult(null);
      await loadSession();
    } catch (e: any) {
      setError(e?.error?.message ?? 'Advance failed');
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
