export interface AIRequest {
  messages: Array<{ role: string; content: string | Array<{ type: string; data?: string; text?: string }> }>;
  response_format?: 'json';
  model?: string;
}

export interface AIResponse {
  content: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export interface AIAdapter {
  sendMultimodalRequest(request: AIRequest): Promise<AIResponse>;
  sendTextRequest(request: AIRequest): Promise<AIResponse>;
}

const VERIFY_RESPONSE = JSON.stringify({
  proposal_id: 'mock-proposal-1',
  session_id: 'mock',
  current_step_id: 'step-1',
  proposed_next_step_id: 'step-2',
  reason: 'Assembly looks correct',
  confidence_score: 0.95,
  evidence_references: [],
  warnings: [],
  mismatch_detected: false,
  mismatch_details: {},
});

const QA_RESPONSE = JSON.stringify({
  answer: 'Based on the manual, you should align the dowels with the pre-drilled holes.',
  source_references: [{ type: 'step', ref: 'step-1' }],
  suggested_actions: ['Check alignment before tightening'],
});

export class MockAIAdapter implements AIAdapter {
  constructor(private readonly responses: Map<string, AIResponse> = new Map()) {}

  async sendMultimodalRequest(request: AIRequest): Promise<AIResponse> {
    const key = this.matchKey(request);
    if (key) return this.responses.get(key)!;
    const hasVerify = request.messages.some((m) => {
      const c = m.content;
      if (typeof c === 'string') return c.toLowerCase().includes('verify');
      return c.some((p) => (p.text ?? '').toLowerCase().includes('verify'));
    });
    return { content: hasVerify ? VERIFY_RESPONSE : QA_RESPONSE };
  }

  async sendTextRequest(request: AIRequest): Promise<AIResponse> {
    const key = this.matchKey(request);
    if (key) return this.responses.get(key)!;
    return { content: QA_RESPONSE };
  }

  private matchKey(request: AIRequest): string | undefined {
    for (const key of this.responses.keys()) {
      if (request.messages.some((m) => typeof m.content === 'string' && m.content.includes(key))) {
        return key;
      }
    }
    return undefined;
  }
}
