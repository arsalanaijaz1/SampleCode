'use client';

import { useState, useEffect } from 'react';

interface StoredEvent {
  eventId: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  internalId: string;
  receivedAt: string;
  status: string;
  attempts: number;
  lastError?: string;
}

interface ApiResponse {
  success: boolean;
  eventId?: string;
  internalId?: string;
  duplicate?: boolean;
  message?: string;
  error?: string;
  details?: Array<{ field: string; message: string }>;
  events?: StoredEvent[];
  count?: number;
}

export default function Home() {
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState<ApiResponse | null>(null);
  
  // Form state
  const [eventId, setEventId] = useState('');
  const [eventType, setEventType] = useState('');
  const [eventData, setEventData] = useState('{}');

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      if (data.success) {
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSubmitResult(null);

    try {
      let parsedData;
      try {
        parsedData = JSON.parse(eventData);
      } catch {
        setSubmitResult({ success: false, error: 'Invalid JSON in data field' });
        setLoading(false);
        return;
      }

      const payload = {
        eventId: eventId || `evt-${Date.now()}`,
        type: eventType,
        timestamp: new Date().toISOString(),
        data: parsedData,
      };

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      setSubmitResult(result);

      if (result.success) {
        fetchEvents();
        if (!result.duplicate) {
          setEventId('');
          setEventType('');
          setEventData('{}');
        }
      }
    } catch (error) {
      setSubmitResult({ success: false, error: 'Network error' });
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          Event Ingestion System
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          Submit events for async processing with idempotency support
        </p>

        {/* Submit Event Form */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Submit New Event
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Event ID (optional, auto-generated if empty)
                </label>
                <input
                  type="text"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  placeholder="evt-12345"
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Event Type *
                </label>
                <input
                  type="text"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  placeholder="user.signup"
                  required
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Event Data (JSON) *
              </label>
              <textarea
                value={eventData}
                onChange={(e) => setEventData(e.target.value)}
                placeholder='{"userId": "u123", "email": "test@example.com"}'
                rows={3}
                required
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Event'}
            </button>
          </form>

          {/* Submit Result */}
          {submitResult && (
            <div className={`mt-4 p-4 rounded-md ${submitResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              {submitResult.success ? (
                <div className="text-green-800 dark:text-green-200">
                  <p className="font-medium">
                    {submitResult.duplicate ? '⚠️ Duplicate Event' : '✓ Event Accepted'}
                  </p>
                  <p className="text-sm mt-1">
                    Event ID: <code className="bg-green-100 dark:bg-green-800 px-1 rounded">{submitResult.eventId}</code>
                  </p>
                  <p className="text-sm">
                    Internal ID: <code className="bg-green-100 dark:bg-green-800 px-1 rounded">{submitResult.internalId}</code>
                  </p>
                </div>
              ) : (
                <div className="text-red-800 dark:text-red-200">
                  <p className="font-medium">✗ Error</p>
                  <p className="text-sm mt-1">{submitResult.error}</p>
                  {submitResult.details && (
                    <ul className="text-sm mt-2 list-disc list-inside">
                      {submitResult.details.map((d, i) => (
                        <li key={i}>{d.field}: {d.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Events List */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Events ({events.length})
            </h2>
            <button
              onClick={fetchEvents}
              className="px-3 py-1 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-200 dark:hover:bg-zinc-600"
            >
              Refresh
            </button>
          </div>

          {events.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">
              No events yet. Submit one above!
            </p>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.internalId}
                  className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-mono text-sm text-zinc-600 dark:text-zinc-400">
                        {event.eventId}
                      </span>
                      <span className="mx-2 text-zinc-300 dark:text-zinc-600">|</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {event.type}
                      </span>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(event.status)}`}>
                      {event.status}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                    Received: {new Date(event.receivedAt).toLocaleString()} | Attempts: {event.attempts}
                  </div>
                  <pre className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded text-xs overflow-x-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                  {event.lastError && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                      Error: {event.lastError}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
