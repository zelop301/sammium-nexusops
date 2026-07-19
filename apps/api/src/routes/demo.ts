import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getTenantId } from '../tenant.js';
import { createDemoPaymentEvent } from '../services/normalizer.js';
import { createEvent } from '../repositories/events.js';
import { enqueueEvent } from '../queue.js';

const DemoPaymentSchema = z.object({
  amount: z.coerce.number().positive().max(10_000_000).default(4999),
  currency: z.string().length(3).default('PHP'),
  customerName: z.string().min(2).max(100).default('Aoki Developer'),
  customerEmail: z.string().email().default('aoki@example.com')
});

export async function demoRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/demo/payments', async (request, reply) => {
    const parsed = DemoPaymentSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });

    const tenantId = getTenantId(request);
    const { raw, normalized } = createDemoPaymentEvent({ tenantId, ...parsed.data });
    const result = await createEvent({
      tenantId,
      provider: 'stripe',
      externalEventId: String(raw.id),
      eventType: normalized.type,
      rawPayload: raw,
      normalizedPayload: normalized
    });

    if (!result.duplicate) await enqueueEvent(result.event.id);
    return reply.code(result.duplicate ? 200 : 202).send({
      duplicate: result.duplicate,
      event: result.event
    });
  });
}
