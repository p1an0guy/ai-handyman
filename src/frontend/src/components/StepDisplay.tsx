import type { CurrentStepResponse } from '../api-types';

type Step = CurrentStepResponse['step'];

export function StepDisplay({ step, diagramUrl }: { step: Step | null; diagramUrl?: string }) {
  if (!step) return null;
  return (
    <div style={{ marginBottom: '12px' }}>
      <h3>Step {step.step_number}: {step.title}</h3>
      <p>{step.description}</p>
      {diagramUrl && (
        <div style={{ marginBottom: '8px' }}>
          <strong>Reference Diagram:</strong>
          <div style={{ marginTop: '4px', border: '1px solid #e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
            <img src={diagramUrl} alt={`Diagram for step ${step.step_number}`} style={{ width: '100%', display: 'block' }} />
          </div>
        </div>
      )}
      {step.parts_required.length > 0 && (
        <div><strong>Parts:</strong> <ul>{step.parts_required.map((part) => <li key={part.part_id}>{part.name} x{part.quantity}</li>)}</ul></div>
      )}
      {step.tools_required.length > 0 && (
        <div><strong>Tools:</strong> <ul>{step.tools_required.map((tool) => <li key={tool.tool_id}>{tool.name}</li>)}</ul></div>
      )}
      {step.safety_notes.length > 0 && (
        <div style={{ background: '#fff3e0', padding: '8px', borderRadius: '4px', marginTop: '8px' }}>
          <strong>Safety:</strong>
          <ul>{step.safety_notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}
      {step.expected_visual_cues.length > 0 && (
        <div><strong>Expected visual cues:</strong> <ul>{step.expected_visual_cues.map((cue, i) => <li key={`${cue.diagram_ref ?? 'cue'}-${i}`}>{cue.description}</li>)}</ul></div>
      )}
    </div>
  );
}
