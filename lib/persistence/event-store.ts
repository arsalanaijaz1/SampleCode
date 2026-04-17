// In-memory event store
// Obviously you'd use a real database in production (Postgres, Mongo, whatever)
// but this keeps things simple for now and the interface stays the same

import type { StoredEvent, EventStatus } from '../types/events';

class EventStore {
  private events = new Map<string, StoredEvent>();
  private byEventId = new Map<string, string>(); // eventId -> internalId lookup

  // Save a new event. Returns null if eventId already exists (that's our idempotency check)
  async save(event: StoredEvent): Promise<StoredEvent | null> {
    if (this.byEventId.has(event.eventId)) {
      return null; // duplicate
    }

    this.events.set(event.internalId, event);
    this.byEventId.set(event.eventId, event.internalId);
    return event;
  }

  async getById(internalId: string): Promise<StoredEvent | null> {
    return this.events.get(internalId) ?? null;
  }

  async getByEventId(eventId: string): Promise<StoredEvent | null> {
    const internalId = this.byEventId.get(eventId);
    if (!internalId) return null;
    return this.events.get(internalId) ?? null;
  }

  async exists(eventId: string): Promise<boolean> {
    return this.byEventId.has(eventId);
  }

  async updateStatus(internalId: string, status: EventStatus, error?: string): Promise<StoredEvent | null> {
    const event = this.events.get(internalId);
    if (!event) return null;

    // bump attempts when we start processing
    const updated: StoredEvent = {
      ...event,
      status,
      attempts: status === 'processing' ? event.attempts + 1 : event.attempts,
      lastError: error,
    };

    this.events.set(internalId, updated);
    return updated;
  }

  // Grab pending events for the worker to process
  async getPendingEvents(limit = 10): Promise<StoredEvent[]> {
    const results: StoredEvent[] = [];
    for (const event of this.events.values()) {
      if (event.status === 'pending') {
        results.push(event);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  // For debugging / the admin UI
  async getAll(): Promise<StoredEvent[]> {
    return Array.from(this.events.values());
  }

  // Useful for tests
  async clear(): Promise<void> {
    this.events.clear();
    this.byEventId.clear();
  }
}

// Single instance - works fine for this use case
export const eventStore = new EventStore();
