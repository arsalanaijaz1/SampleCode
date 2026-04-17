// Main service for event ingestion
// This ties together validation, storage, and queuing

import { randomUUID } from 'crypto';
import type { EventPayload, StoredEvent, EventIngestionResult } from '../types/events';
import { validateEventPayload } from '../validation/event-validator';
import { eventStore } from '../persistence/event-store';
import { eventQueue } from '../queue/event-queue';

export class EventService {
  
  // The main entry point - takes raw payload, returns result
  async ingestEvent(payload: unknown): Promise<EventIngestionResult> {
    
    // Step 1: Validate
    const validation = validateEventPayload(payload);
    if (!validation.valid) {
      const msg = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
      throw new ValidationError(`Invalid payload: ${msg}`, validation.errors);
    }

    const eventData = payload as EventPayload;

    // Step 2: Check if we've seen this before (idempotency)
    const existing = await eventStore.getByEventId(eventData.eventId);
    if (existing) {
      return {
        success: true,
        eventId: existing.eventId,
        internalId: existing.internalId,
        duplicate: true,
        message: 'Event already received',
      };
    }

    // Step 3: Build our internal record
    const event: StoredEvent = {
      ...eventData,
      internalId: randomUUID(),
      receivedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    };

    // Step 4: Persist it
    const saved = await eventStore.save(event);
    if (!saved) {
      // Edge case: someone else saved it between our check and save
      // (shouldn't really happen with in-memory store, but good habit)
      const alreadyThere = await eventStore.getByEventId(eventData.eventId);
      if (alreadyThere) {
        return {
          success: true,
          eventId: alreadyThere.eventId,
          internalId: alreadyThere.internalId,
          duplicate: true,
          message: 'Event already received',
        };
      }
      throw new Error('Failed to save event'); // something weird happened
    }

    // Step 5: Queue it for async processing
    await eventQueue.enqueue(event.internalId);

    return {
      success: true,
      eventId: event.eventId,
      internalId: event.internalId,
      duplicate: false,
      message: 'Event accepted',
    };
  }

  // Lookup helpers
  async getEvent(internalId: string) {
    return eventStore.getById(internalId);
  }

  async getEventByEventId(eventId: string) {
    return eventStore.getByEventId(eventId);
  }

  async getAllEvents() {
    return eventStore.getAll();
  }
}

// Custom error for validation failures
export class ValidationError extends Error {
  constructor(message: string, public errors: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const eventService = new EventService();
