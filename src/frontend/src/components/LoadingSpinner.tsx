export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
      <p>{message}</p>
    </div>
  );
}
