import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { EVENT_QUEUE } from '@nexus/contracts';
import { config } from './config.js';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true
});

export const eventQueue = new Queue(EVENT_QUEUE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: 500,
    removeOnFail: 1_000
  }
});

export async function enqueueEvent(eventId: string): Promise<void> {
  await eventQueue.add('process-event', { eventId }, { jobId: `${eventId}-${Date.now()}` });
}
