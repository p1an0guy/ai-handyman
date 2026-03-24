interface Step {
  step_id: string;
  step_number: number;
  title: string;
  description: string;
  parts_required: string[];
  tools_required: string[];
  safety_notes: string[];
  expected_visual_cues: string[];
}

export function StepDisplay({ step }: { step: Step | null }) {
  if (!step) return null;
  return (
    <div style={{ marginBottom: '12px' }}>
      <h3>Step {step.step_number}: {step.title}</h3>
      <p>{step.description}</p>
      {step.parts_required.length > 0 && (
        <div><strong>Parts:</strong> <ul>{step.parts_required.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
      )}
      {step.tools_required.length > 0 && (
        <div><strong>Tools:</strong> <ul>{step.tools_required.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
      )}
      {step.safety_notes.length > 0 && (
        <div style={{ background: '#fff3e0', padding: '8px', borderRadius: '4px', marginTop: '8px' }}>
          <strong>Safety:</strong>
          <ul>{step.safety_notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}
      {step.expected_visual_cues.length > 0 && (
        <div><strong>Expected visual cues:</strong> <ul>{step.expected_visual_cues.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
      )}
    </div>
  );
}
