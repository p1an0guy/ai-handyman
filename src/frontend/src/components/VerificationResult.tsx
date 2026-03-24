import type { VerifyStepResponse } from '../api-types';

interface VerificationResultProps {
  result: VerifyStepResponse | null;
  onOverride?: () => void;
  onReCapture?: () => void;
  onAdvance?: () => void;
}

export function VerificationResult({ result, onOverride, onReCapture, onAdvance }: VerificationResultProps) {
  if (!result) return null;

  const bgColor = result.verification_result === 'pass' ? '#e8f5e9'
    : result.verification_result === 'fail' ? '#ffebee' : '#fff3e0';

  return (
    <div style={{ background: bgColor, padding: '12px', borderRadius: '8px', marginBottom: '10px' }}>
      <p><strong>Result:</strong> {result.verification_result.toUpperCase()} — Confidence: {Math.round(result.confidence_score * 100)}%</p>
      {result.warnings.length > 0 && (
        <ul>{result.warnings.map((warning) => <li key={warning.warning_id}>{warning.message}</li>)}</ul>
      )}
      {result.verification_result === 'pass' && (
        <button onClick={onAdvance}>Next Step</button>
      )}
      {result.verification_result === 'fail' && (
        <div>
          {result.mismatch && <p>{result.mismatch.description ?? result.mismatch.type ?? 'Mismatch detected'}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onReCapture}>Re-capture</button>
            <button onClick={onOverride}>Override</button>
          </div>
        </div>
      )}
      {result.verification_result === 'insufficient' && (
        <div>
          {result.additional_evidence_request && <p>{result.additional_evidence_request.guidance}</p>}
          <button onClick={onReCapture}>Take Another Photo</button>
        </div>
      )}
    </div>
  );
}
