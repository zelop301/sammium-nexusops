import { DEAD_LETTER_QUEUE, EVENT_QUEUE, CanonicalEventSchema, WorkflowActionSchema, WorkflowConditionSchema } from '@nexus/contracts';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from './config.js';
import { pool, query } from './db.js';
import { executeAction } from './actions.js';
import { workflowMatches } from './workflow.js';

interface EventRow {
  id: string;
  normalized_payload: unknown;
  status: string;
}

interface WorkflowRow {
  id: string;
  name: string;
  conditions: unknown;
  actions: unknown;
}

const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const deadLetterQueue = new Queue(DEAD_LETTER_QUEUE, { connection });

const worker = new Worker(
  EVENT_QUEUE,
  async (job) => {
    const eventId = String(job.data.eventId);
    const rows = await query<EventRow>(`SELECT id, normalized_payload, status FROM events WHERE id = $1`, [eventId]);
    const row = rows[0];
    if (!row) throw new Error(`Event ${eventId} was not found.`);

    const event = CanonicalEventSchema.parse(row.normalized_payload);
    const attempt = job.attemptsMade + 1;
    await query(
      `UPDATE events SET status = 'PROCESSING', attempts = $2, last_error = NULL, updated_at = NOW() WHERE id = $1`,
      [eventId, attempt]
    );

    try {
      const workflows = await query<WorkflowRow>(
        `SELECT id, name, conditions, actions FROM workflows
         WHERE tenant_id = $1 AND trigger_type = $2 AND enabled = TRUE`,
        [event.tenantId, event.type]
      );

      let matched = 0;
      for (const workflow of workflows) {
        const conditions = Array.isArray(workflow.conditions)
          ? workflow.conditions.map((item) => WorkflowConditionSchema.parse(item))
          : [];
        if (!workflowMatches(event, conditions)) continue;
        matched += 1;
        const actions = Array.isArray(workflow.actions)
          ? workflow.actions.map((item) => WorkflowActionSchema.parse(item))
          : [];
        for (const [actionIndex, action] of actions.entries()) {
          await executeAction({ event, eventId, workflowId: workflow.id, action, actionIndex, attempt });
        }
      }

      await query(
        `UPDATE events SET status = 'SUCCEEDED', processed_at = NOW(), updated_at = NOW(), last_error = NULL WHERE id = $1`,
        [eventId]
      );
      return { eventId, matchedWorkflows: matched };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await query(`UPDATE events SET status = 'FAILED', last_error = $2, updated_at = NOW() WHERE id = $1`, [eventId, message]);
      throw error;
    }
  },
  { connection, concurrency: 5 }
);

worker.on('completed', (job, result) => {
  console.log('[worker] completed', job.id, result);
});

worker.on('failed', async (job, error) => {
  console.error('[worker] failed', job?.id, error.message);
  if (!job) return;
  const maxAttempts = Number(job.opts.attempts ?? 1);
  if (job.attemptsMade >= maxAttempts) {
    const eventId = String(job.data.eventId);
    await query(
      `UPDATE events SET status = 'DEAD_LETTER', last_error = $2, updated_at = NOW() WHERE id = $1`,
      [eventId, error.message]
    );
    await deadLetterQueue.add('dead-letter-event', {
      eventId,
      sourceQueue: EVENT_QUEUE,
      failedAt: new Date().toISOString(),
      error: error.message
    });
  }
});

const shutdown = async () => {
  await worker.close();
  await deadLetterQueue.close();
  await connection.quit();
  await pool.end();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('[worker] NexusOps integration worker is ready');
