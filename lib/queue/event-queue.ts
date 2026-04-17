// Simple in-memory job queue
// In prod you'd want Redis, SQS, or something that survives restarts
// but this shows the pattern without external dependencies

import type { StoredEvent } from '../types/events';
import { eventStore } from '../persistence/event-store';

export type EventHandler = (event: StoredEvent) => Promise<void>;

interface QueuedJob {
  internalId: string;
  enqueuedAt: number;
  retries: number;
}

class EventQueue {
  private jobs: QueuedJob[] = [];
  private isRunning = false;
  private handler: EventHandler | null = null;
  
  // Config- could make these configrable but keeping it simple
  private maxRetries = 3;
  private delayBetweenJobs = 100; // ms, just to simulate real async work

  setHandler(fn: EventHandler) {
    this.handler = fn;
  }

  async enqueue(internalId: string) {
    this.jobs.push({
      internalId,
      enqueuedAt: Date.now(),
      retries: 0,
    });
    this.kickOffProcessing();
  }

  get length() { return this.jobs.length; }
  get isProcessing() { return this.isRunning; }

  private kickOffProcessing() {
    if (this.isRunning) return; // already going
    this.isRunning = true;
    this.runLoop();
  }

  private async runLoop() {
    while (this.jobs.length > 0) {
      const job = this.jobs.shift()!;
      await this.processJob(job);
      await this.sleep(this.delayBetweenJobs);
    }
    this.isRunning = false;
  }

  private async processJob(job: QueuedJob) {
    if (!this.handler) {
      console.warn('[Queue] No handler set, skipping:', job.internalId);
      return;
    }

    try {
      // Mark as processing (also bumps attempt count)
      const event = await eventStore.updateStatus(job.internalId, 'processing');
      if (!event) {
        console.error('[Queue] Event not found:', job.internalId);
        return;
      }

      await this.handler(event);
      await eventStore.updateStatus(job.internalId, 'completed');
      console.log('[Queue] Done:', job.internalId);
      
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Queue] Failed:', job.internalId, msg);

      if (job.retries < this.maxRetries) {
        // back of the queue for another try
        console.log(`[Queue] Retry ${job.retries + 1}/${this.maxRetries}:`, job.internalId);
        this.jobs.push({ ...job, retries: job.retries + 1 });
        await eventStore.updateStatus(job.internalId, 'pending', msg);
      } else {
        console.error('[Queue] Giving up on:', job.internalId);
        await eventStore.updateStatus(job.internalId, 'failed', msg);
      }
    }
  }

  private sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }

  clear() { this.jobs = []; }
}

export const eventQueue = new EventQueue();

// Wire up a basic handler - in reality this would call downstream services,
// fire webhooks, update analytics, etc.
eventQueue.setHandler(async (event) => {
  console.log(`[Handler] Processing ${event.type}: ${event.eventId}`);
  // Fake some work
  await new Promise(r => setTimeout(r, 50));
  console.log(`[Handler] Done with ${event.eventId}`);
});
