// POST /api/events - accept new events
// GET /api/events - list all (or fetch one by ?eventId=xxx)

import type { NextRequest } from 'next/server';
import { eventService, ValidationError } from '@/lib/services/event-service';

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const result = await eventService.ingestEvent(body);
    
    // 202 for new events, 200 for duplicates (idempotent response)
    return Response.json(result, { status: result.duplicate ? 200 : 202 });
    
  } catch (err) {
    if (err instanceof ValidationError) {
      return Response.json({
        success: false,
        error: err.message,
        details: err.errors,
      }, { status: 400 });
    }

    // Something unexpected - log it
    console.error('[POST /api/events]', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get('eventId');

    if (eventId) {
      const event = await eventService.getEventByEventId(eventId);
      if (!event) {
        return Response.json({ success: false, error: 'Not found' }, { status: 404 });
      }
      return Response.json({ success: true, event });
    }

    // No specific ID = list all
    const events = await eventService.getAllEvents();
    return Response.json({ success: true, count: events.length, events });
    
  } catch (err) {
    console.error('[GET /api/events]', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
