interface ErrorDisplayProps {
  error: string | null;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export function ErrorDisplay({ error, onDismiss, onRetry }: ErrorDisplayProps) {
  if (!error) return null;
  return (
    <div style={{ padding: '12px', background: '#ffebee', border: '1px solid #ef5350', borderRadius: '8px', marginBottom: '10px' }}>
      <p style={{ margin: 0, color: '#c62828' }}>{error}</p>
      <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
        {onRetry && <button onClick={onRetry}>Retry</button>}
        {onDismiss && <button onClick={onDismiss}>Dismiss</button>}
      </div>
    </div>
  );
}
