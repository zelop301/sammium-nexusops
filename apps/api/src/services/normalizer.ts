import { randomUUID } from 'node:crypto';
import type { CanonicalEvent } from '@nexus/contracts';

function money(value: unknown): number {
  return typeof value === 'number' ? Math.round(value) / 100 : 0;
}

function customerIdentity(object: Record<string, any>) {
  const details = object.billing_details ?? object.customer_details ?? {};
  const name = typeof details.name === 'string' ? details.name : '';
  const [firstName = '', ...rest] = name.split(' ');
  return {
    email: details.email ?? object.receipt_email ?? object.customer_email ?? null,
    name: name || null,
    firstName: firstName || null,
    lastName: rest.join(' ') || null
  };
}

export function normalizeStripeEvent(raw: Record<string, any>, tenantId: string): CanonicalEvent {
  const object = raw?.data?.object ?? {};
  const map: Record<string, string> = {
    'payment_intent.succeeded': 'payment.succeeded',
    'payment_intent.payment_failed': 'payment.failed',
    'checkout.session.completed': 'checkout.completed',
    'invoice.paid': 'invoice.paid',
    'invoice.payment_failed': 'invoice.failed',
    'customer.subscription.created': 'subscription.created',
    'customer.subscription.updated': 'subscription.updated',
    'customer.subscription.deleted': 'subscription.cancelled',
    'charge.refunded': 'payment.refunded'
  };

  const amountRaw = object.amount_received ?? object.amount_total ?? object.amount_paid ?? object.amount ?? 0;
  const correlationId = randomUUID();

  return {
    specVersion: '1.0',
    id: randomUUID(),
    source: 'stripe',
    type: map[raw.type] ?? `stripe.${String(raw.type ?? 'unknown')}`,
    time: new Date((raw.created ?? Date.now() / 1000) * 1000).toISOString(),
    tenantId,
    subject: String(object.customer ?? object.id ?? raw.id ?? 'unknown'),
    correlationId,
    data: {
      externalEventId: raw.id ?? null,
      externalObjectId: object.id ?? null,
      customerId: object.customer ?? null,
      amount: money(amountRaw),
      currency: String(object.currency ?? 'php').toUpperCase(),
      status: object.status ?? null,
      description: object.description ?? null,
      ...customerIdentity(object)
    }
  };
}

export function createDemoPaymentEvent(input: {
  tenantId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
}): { raw: Record<string, unknown>; normalized: CanonicalEvent } {
  const externalEventId = `evt_demo_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const paymentId = `pi_demo_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const created = Math.floor(Date.now() / 1000);
  const raw = {
    id: externalEventId,
    type: 'payment_intent.succeeded',
    created,
    livemode: false,
    data: {
      object: {
        id: paymentId,
        amount_received: Math.round(input.amount * 100),
        currency: input.currency.toLowerCase(),
        customer: `cus_demo_${randomUUID().slice(0, 8)}`,
        status: 'succeeded',
        description: 'NexusOps generated portfolio demo payment',
        billing_details: {
          name: input.customerName,
          email: input.customerEmail
        }
      }
    }
  };

  return { raw, normalized: normalizeStripeEvent(raw, input.tenantId) };
}
