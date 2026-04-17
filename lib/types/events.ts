// Types for the event system
// Kept these pretty minimal - we can always add more fields later

export interface EventPayload {
  eventId: string;      // client provides this for idempotency
  type: string;         // e.g. "user.signup", "order.created"
  timestamp: string;    // ISO 8601
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;  // optional extra context
}

// What we actually store (adds our internal tracking fields)
export interface StoredEvent extends EventPayload {
  internalId: string;   // our UUID, not the client's
  receivedAt: string;
  status: EventStatus;
  attempts: number;
  lastError?: string;   // only set if something went wrong
}

export type EventStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Response shape for the ingest endpoint
export interface EventIngestionResult {
  success: boolean;
  eventId: string;
  internalId: string;
  duplicate: boolean;   // true = we've seen this eventId before
  message: string;
}

// Validation stuff
export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
