import type { VerifyStepResponse } from '../api-types';

interface VerificationResultProps {
  result: VerifyStepResponse | null;
  capturedImage?: string;
  onOverride?: () => void;
  onReCapture?: () => void;
  onAdvance?: () => void;
}

export function VerificationResult({ result, capturedImage, onOverride, onReCapture, onAdvance }: VerificationResultProps) {
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
          {(capturedImage || result.mismatch?.expected_diagram) && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              {capturedImage && (
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 'bold', fontSize: '0.85em' }}>Your Evidence</p>
                  <img src={capturedImage} alt="Captured evidence" style={{ width: '100%', borderRadius: '4px', border: '1px solid #e0e0e0' }} />
                </div>
              )}
              {result.mismatch?.expected_diagram && (
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 'bold', fontSize: '0.85em' }}>Expected</p>
                  <img src={result.mismatch.expected_diagram} alt="Expected diagram" style={{ width: '100%', borderRadius: '4px', border: '1px solid #e0e0e0' }} />
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onReCapture}>Re-capture</button>
            <button onClick={onOverride}>Override</button>
          </div>
        </div>
      )}
      {result.verification_result === 'insufficient' && (
        <div>
          {result.additional_evidence_request && (
            <>
              {result.additional_evidence_request.guidance && <p>{result.additional_evidence_request.guidance}</p>}
              {result.additional_evidence_request.focus_area && (
                <p style={{ fontSize: '0.85em', color: '#666' }}>Focus area: {result.additional_evidence_request.focus_area}</p>
              )}
            </>
          )}
          <button onClick={onReCapture}>Take Another Photo</button>
        </div>
      )}
    </div>
  );
}
