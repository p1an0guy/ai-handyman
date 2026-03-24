import { useState } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ type: string; ref: string }>;
  actions?: string[];
}

interface ChatPanelProps {
  sessionId: string;
  currentStepId?: string;
}

export function ChatPanel({ sessionId, currentStepId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);
    try {
      const res = await fetch(`/api/session/${sessionId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context_step_id: currentStepId }),
      });
      if (!res.ok) throw await res.json();
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.source_references,
        actions: data.suggested_actions,
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I could not process your question.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '10px', maxHeight: '400px', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ margin: '0 0 10px' }}>Ask a Question</h3>
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '10px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: '8px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <div style={{
              display: 'inline-block', padding: '8px 12px', borderRadius: '12px', maxWidth: '80%',
              background: msg.role === 'user' ? '#1976d2' : '#f5f5f5',
              color: msg.role === 'user' ? '#fff' : '#333',
            }}>
              {msg.content}
            </div>
            {msg.sources && msg.sources.length > 0 && (
              <div style={{ fontSize: '0.8em', color: '#666', marginTop: '2px' }}>
                Sources: {msg.sources.map(s => `${s.type}:${s.ref}`).join(', ')}
              </div>
            )}
            {msg.actions && msg.actions.length > 0 && (
              <div style={{ fontSize: '0.8em', color: '#1976d2', marginTop: '2px' }}>
                Suggested: {msg.actions.join(', ')}
              </div>
            )}
          </div>
        ))}
        {loading && <div style={{ color: '#999' }}>Thinking...</div>}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about this step..."
          style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>Send</button>
      </div>
    </div>
  );
}
