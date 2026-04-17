// Validation for incoming event payloads
// Tried to keep error messages helpful without being too verbose

import type { EventPayload, ValidationResult, ValidationError } from '../types/events';

// These limits are somewhat arbitrary - adjust based on your needs
const MAX_EVENT_ID_LENGTH = 128;
const MAX_TYPE_LENGTH = 64;
const MAX_DATA_SIZE = 64 * 1024; // 64KB should be plenty for most events

export function validateEventPayload(payload: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // Quick sanity check - is this even an object?
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: [{ field: 'payload', message: 'Payload must be a JSON object' }] };
  }

  const event = payload as Record<string, unknown>; // typescript appeased

  // eventId - the client's idempotency key
  if (!event.eventId) {
    errors.push({ field: 'eventId', message: 'eventId is required' });
  } else if (typeof event.eventId !== 'string') {
    errors.push({ field: 'eventId', message: 'eventId must be a string' });
  } else if (event.eventId.length > MAX_EVENT_ID_LENGTH) {
    errors.push({ field: 'eventId', message: `eventId too long (max ${MAX_EVENT_ID_LENGTH} chars)` });
  } else if (!/^[a-zA-Z0-9_-]+$/.test(event.eventId)) {
    // keeping it simple - alphanumeric plus dash/underscore
    errors.push({ field: 'eventId', message: 'eventId can only contain letters, numbers, dashes, underscores' });
  }

  // type field
  if (!event.type) {
    errors.push({ field: 'type', message: 'type is required' });
  } else if (typeof event.type !== 'string') {
    errors.push({ field: 'type', message: 'type must be a string' });
  } else if (event.type.length > MAX_TYPE_LENGTH) {
    errors.push({ field: 'type', message: `type too long (max ${MAX_TYPE_LENGTH} chars)` });
  }
  // TODO: maybe validate type format like "category.action"?

  // timestamp - must be parseable
  if (!event.timestamp) {
    errors.push({ field: 'timestamp', message: 'timestamp is required' });
  } else if (typeof event.timestamp !== 'string') {
    errors.push({ field: 'timestamp', message: 'timestamp must be a string' });
  } else {
    const parsed = new Date(event.timestamp);
    if (isNaN(parsed.getTime())) {
      errors.push({ field: 'timestamp', message: 'timestamp must be valid ISO 8601' });
    }
    // Note: we're not checking if it's in the future or too old - maybe add that later
  }

  // data - the actual event payload
  if (!event.data) {
    errors.push({ field: 'data', message: 'data is required' });
  } else if (typeof event.data !== 'object' || Array.isArray(event.data)) {
    errors.push({ field: 'data', message: 'data must be a JSON object' });
  } else {
    // Don't let people send us giant payloads
    const size = JSON.stringify(event.data).length;
    if (size > MAX_DATA_SIZE) {
      errors.push({ field: 'data', message: `data too large (${size} bytes, max is ${MAX_DATA_SIZE})` });
    }
  }

  // metadata is optional, but if present it should be an object
  if (event.metadata !== undefined && (typeof event.metadata !== 'object' || Array.isArray(event.metadata))) {
    errors.push({ field: 'metadata', message: 'metadata must be an object if provided' });
  }

  return { valid: errors.length === 0, errors };
}

// Type guard - handy for narrowing types
export function isValidEventPayload(payload: unknown): payload is EventPayload {
  return validateEventPayload(payload).valid;
}
