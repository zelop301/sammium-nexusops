import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { config } from '../config.js';
import { getTenantId } from '../tenant.js';
import { normalizeStripeEvent } from '../services/normalizer.js';
import { createEvent } from '../repositories/events.js';
import { enqueueEvent } from '../queue.js';

const stripe = config.STRIPE_SECRET_KEY ? new Stripe(config.STRIPE_SECRET_KEY) : null;

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/webhooks/stripe', { config: { rawBody: true } }, async (request, reply) => {
    const tenantId = getTenantId(request);
    let event: Record<string, any>;

    if (stripe && config.STRIPE_WEBHOOK_SECRET) {
      const signature = request.headers['stripe-signature'];
      if (typeof signature !== 'string') return reply.code(400).send({ error: 'MISSING_STRIPE_SIGNATURE' });
      try {
        event = stripe.webhooks.constructEvent(
          (request as typeof request & { rawBody: Buffer }).rawBody,
          signature,
          config.STRIPE_WEBHOOK_SECRET
        ) as unknown as Record<string, any>;
      } catch (error) {
        return reply.code(400).send({ error: 'INVALID_STRIPE_SIGNATURE', message: error instanceof Error ? error.message : 'Unknown error' });
      }
    } else if (config.DEMO_MODE) {
      event = request.body as Record<string, any>;
    } else {
      return reply.code(503).send({ error: 'STRIPE_NOT_CONFIGURED' });
    }

    const normalized = normalizeStripeEvent(event, tenantId);
    const externalEventId = String(event.id ?? normalized.id);
    const result = await createEvent({
      tenantId,
      provider: 'stripe',
      externalEventId,
      eventType: normalized.type,
      rawPayload: event,
      normalizedPayload: normalized
    });

    if (!result.duplicate) await enqueueEvent(result.event.id);
    return reply.code(200).send({ received: true, duplicate: result.duplicate, eventId: result.event.id });
  });
}
