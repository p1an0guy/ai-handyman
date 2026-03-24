interface SessionControlsProps {
  state: string;
  onPause: () => void;
  onResume: () => void;
}

export function SessionControls({ state, onPause, onResume }: SessionControlsProps) {
  if (state === 'SESSION_COMPLETE') {
    return <div style={{ padding: '20px', textAlign: 'center', background: '#e8f5e9', borderRadius: '8px' }}>
      <h2>Assembly Complete!</h2>
      <p>Congratulations, you've finished assembling your furniture.</p>
    </div>;
  }

  if (state === 'SESSION_PAUSED') {
    return <div style={{ padding: '10px', background: '#fff3e0', borderRadius: '8px', marginBottom: '10px' }}>
      <p>Session is paused.</p>
      <button onClick={onResume}>Resume Session</button>
    </div>;
  }

  return <div style={{ marginBottom: '10px' }}>
    <button onClick={onPause}>Pause Session</button>
  </div>;
}
