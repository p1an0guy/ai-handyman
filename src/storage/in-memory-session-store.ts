import type { SessionState } from '../models/index.js';
import type { SessionStore, SessionFilters, SessionSummary } from './interfaces.js';

export class InMemorySessionStore implements SessionStore {
  private store = new Map<string, SessionState>();

  async save(session: SessionState): Promise<void> {
    const existing = this.store.get(session.session_id);
    if (existing && existing.version !== session.version) {
      throw { code: 'VERSION_CONFLICT', message: `Version conflict for session ${session.session_id}` };
    }
    const copy: SessionState = JSON.parse(JSON.stringify(session));
    copy.version = session.version + 1;
    this.store.set(copy.session_id, copy);
  }

  async load(sessionId: string): Promise<SessionState | null> {
    const session = this.store.get(sessionId);
    return session ? JSON.parse(JSON.stringify(session)) : null;
  }

  async list(filters?: SessionFilters): Promise<SessionSummary[]> {
    return Array.from(this.store.values())
      .filter(s =>
        (!filters?.manual_id || s.manual_id === filters.manual_id) &&
        (!filters?.session_lifecycle_state || s.session_lifecycle_state === filters.session_lifecycle_state)
      )
      .map(s => ({
        session_id: s.session_id,
        manual_id: s.manual_id,
        session_lifecycle_state: s.session_lifecycle_state,
        step_workflow_state: s.step_workflow_state,
        created_at: s.created_at,
        updated_at: s.updated_at,
      }));
  }
}
