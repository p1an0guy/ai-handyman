import type { StructuredEvent } from '../models/index.js';
import type { EventLog, EventFilters } from './interfaces.js';

export class InMemoryEventLog implements EventLog {
  private events: StructuredEvent[] = [];

  async append(event: StructuredEvent): Promise<void> {
    this.events.push(event);
  }

  async query(sessionId: string, filters?: EventFilters): Promise<StructuredEvent[]> {
    return this.events.filter(e => {
      if (e.session_id !== sessionId) return false;
      if (filters?.event_type && e.event_type !== filters.event_type) return false;
      if (filters?.from_timestamp && e.timestamp < filters.from_timestamp) return false;
      if (filters?.to_timestamp && e.timestamp > filters.to_timestamp) return false;
      return true;
    });
  }

  async *replaySession(sessionId: string): AsyncIterable<StructuredEvent> {
    const events = this.events
      .filter(e => e.session_id === sessionId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (const event of events) {
      yield event;
    }
  }
}
