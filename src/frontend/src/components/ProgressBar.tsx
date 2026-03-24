export function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return <div style={{ marginBottom: '10px' }}>
    <div style={{ background: '#eee', borderRadius: '4px', height: '20px', overflow: 'hidden' }}>
      <div style={{ background: '#4caf50', height: '100%', width: `${pct}%`, transition: 'width 0.3s' }} />
    </div>
    <small>{completed} / {total} steps ({pct}%)</small>
  </div>;
}
