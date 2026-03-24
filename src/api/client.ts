import type * as C from './contracts.js';

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async createSession(manualId: string): Promise<C.CreateSessionResponse> {
    return this.post('/sessions', { manual_id: manualId });
  }

  async startSession(sessionId: string): Promise<C.StartSessionResponse> {
    return this.post(`/session/${sessionId}/start`, {});
  }

  async getCurrentStep(sessionId: string): Promise<C.CurrentStepResponse> {
    return this.get(`/session/${sessionId}/current_step`);
  }

  async getStepContext(sessionId: string, stepId?: string): Promise<C.StepContextResponse> {
    const query = stepId ? `?step_id=${stepId}` : '';
    return this.get(`/session/${sessionId}/step_context${query}`);
  }

  async verifyStep(sessionId: string, req: C.VerifyStepRequest): Promise<C.VerifyStepResponse> {
    return this.post(`/session/${sessionId}/verify_step`, req);
  }

  async override(sessionId: string, req: C.OverrideRequest): Promise<C.OverrideResponse> {
    return this.post(`/session/${sessionId}/override`, req);
  }

  async pauseSession(sessionId: string, resumeToken: string): Promise<C.PauseResponse> {
    return this.post(`/session/${sessionId}/pause`, { resume_token: resumeToken });
  }

  async resumeSession(sessionId: string, resumeToken: string): Promise<C.ResumeResponse> {
    return this.post(`/session/${sessionId}/resume`, { resume_token: resumeToken });
  }

  async ask(sessionId: string, req: C.AskRequest): Promise<C.AskResponse> {
    return this.post(`/session/${sessionId}/ask`, req);
  }

  async advanceStep(sessionId: string): Promise<C.AdvanceResponse> {
    return this.post(`/session/${sessionId}/advance`, {});
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw await res.json();
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await res.json();
    return res.json() as Promise<T>;
  }
}
