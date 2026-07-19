import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db.js';
import { getTenantId } from '../tenant.js';
import { enqueueEvent } from '../queue.js';

const ListSchema = z.object({
  status: z.string().optional(),
  provider: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0)
});

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/events', async (request, reply) => {
    const parsed = ListSchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    const tenantId = getTenantId(request);
    const filters: string[] = ['tenant_id = $1'];
    const values: unknown[] = [tenantId];

    if (parsed.data.status) {
      values.push(parsed.data.status);
      filters.push(`status = $${values.length}`);
    }
    if (parsed.data.provider) {
      values.push(parsed.data.provider);
      filters.push(`provider = $${values.length}`);
    }
    values.push(parsed.data.limit, parsed.data.offset);

    const events = await query(
      `SELECT id, provider, external_event_id, event_type, status, correlation_id, attempts,
              last_error, created_at, updated_at, processed_at, normalized_payload
       FROM events
       WHERE ${filters.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    const total = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM events WHERE ${filters.join(' AND ')}`, values.slice(0, values.length - 2));
    return { items: events, total: Number(total[0]?.count ?? 0) };
  });

  app.get('/api/v1/events/:eventId', async (request, reply) => {
    const eventId = (request.params as { eventId: string }).eventId;
    const tenantId = getTenantId(request);
    const events = await query(`SELECT * FROM events WHERE id = $1 AND tenant_id = $2`, [eventId, tenantId]);
    if (!events[0]) return reply.code(404).send({ error: 'EVENT_NOT_FOUND' });
    const actions = await query(`SELECT * FROM action_executions WHERE event_id = $1 ORDER BY started_at ASC`, [eventId]);
    return { event: events[0], actions };
  });

  app.post('/api/v1/events/:eventId/replay', async (request, reply) => {
    const eventId = (request.params as { eventId: string }).eventId;
    const tenantId = getTenantId(request);
    const updated = await query(
      `UPDATE events SET status = 'QUEUED', last_error = NULL, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [eventId, tenantId]
    );
    if (!updated[0]) return reply.code(404).send({ error: 'EVENT_NOT_FOUND' });
    await enqueueEvent(eventId);
    return reply.code(202).send({ replayed: true, event: updated[0] });
  });
}
