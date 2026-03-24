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

const COMPARE_RESPONSE = JSON.stringify({
  passed: true,
  confidence_score: 0.95,
  mismatch_detected: false,
  guidance: null,
});

const CLASSIFY_RESPONSE = JSON.stringify({
  type: 'other',
  description: 'No mismatch detected',
  confidence_score: 0.95,
});

const STEP_GRAPH_RESPONSE = JSON.stringify({
  version: '1.0.0',
  steps: [
    {
      step_id: 'step-1',
      step_number: 1,
      title: 'Prepare the base',
      description: 'Place the base panel on a flat surface.',
      parts_required: [],
      tools_required: [],
      prerequisites: [],
      safety_notes: [],
      expected_visual_cues: [{ description: 'Base panel laid flat' }],
      common_errors: [],
      completion_checks: [],
    },
  ],
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
    const hasCompare = request.messages.some((m) => {
      const c = m.content;
      if (typeof c === 'string') return c.toLowerCase().includes('compare this assembly evidence');
      return c.some((p) => (p.text ?? '').toLowerCase().includes('compare this assembly evidence'));
    });
    const hasClassify = request.messages.some((m) => {
      const c = m.content;
      if (typeof c === 'string') return c.toLowerCase().includes('classify the mismatch');
      return c.some((p) => (p.text ?? '').toLowerCase().includes('classify the mismatch'));
    });
    if (hasCompare) return { content: COMPARE_RESPONSE };
    if (hasClassify) return { content: CLASSIFY_RESPONSE };
    return { content: hasVerify ? VERIFY_RESPONSE : QA_RESPONSE };
  }

  async sendTextRequest(request: AIRequest): Promise<AIResponse> {
    const key = this.matchKey(request);
    if (key) return this.responses.get(key)!;
    const prompt = request.messages.map((message) => typeof message.content === 'string' ? message.content : message.content.map((part) => part.text ?? '').join(' ')).join(' ');
    if (prompt.toLowerCase().includes('extract a structured step graph')) {
      return { content: STEP_GRAPH_RESPONSE };
    }
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

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  baseDelayMs?: number;
}

export class GeminiDevAPIAdapter implements AIAdapter {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'gemini-2.0-flash';
    this.maxRetries = config.maxRetries ?? 3;
    this.baseDelayMs = config.baseDelayMs ?? 1000;
  }

  async sendMultimodalRequest(request: AIRequest): Promise<AIResponse> {
    return this.send(request);
  }

  async sendTextRequest(request: AIRequest): Promise<AIResponse> {
    return this.send(request);
  }

  private async send(request: AIRequest): Promise<AIResponse> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.doRequest(request);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          await this.delay(this.baseDelayMs * Math.pow(2, attempt));
        }
      }
    }
    throw { code: 'AI_PROVIDER_ERROR', message: `Gemini API failed after ${this.maxRetries + 1} attempts: ${lastError?.message}` };
  }

  private async doRequest(request: AIRequest): Promise<AIResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const contents = request.messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: typeof m.content === 'string'
        ? [{ text: m.content }]
        : m.content.map(p => p.data ? { inlineData: { mimeType: 'image/jpeg', data: p.data } } : { text: p.text ?? '' }),
    }));

    const body: Record<string, unknown> = { contents };
    if (request.response_format === 'json') {
      body.generationConfig = { responseMimeType: 'application/json' };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini API ${res.status}: ${errBody}`);
    }

    const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return {
      content: text,
      usage: json.usageMetadata ? { prompt_tokens: json.usageMetadata.promptTokenCount ?? 0, completion_tokens: json.usageMetadata.candidatesTokenCount ?? 0 } : undefined,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
