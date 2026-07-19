import { describe, expect, it } from 'vitest';
import { createDemoPaymentEvent, normalizeStripeEvent } from './normalizer.js';

const tenantId = '11111111-1111-4111-8111-111111111111';

describe('Stripe event normalization', () => {
  it('normalizes a successful payment into the canonical event shape', () => {
    const { raw } = createDemoPaymentEvent({
      tenantId,
      amount: 4999,
      currency: 'PHP',
      customerName: 'Aoki Developer',
      customerEmail: 'aoki@example.com'
    });
    const result = normalizeStripeEvent(raw, tenantId);
    expect(result.type).toBe('payment.succeeded');
    expect(result.data.amount).toBe(4999);
    expect(result.data.currency).toBe('PHP');
    expect(result.data.email).toBe('aoki@example.com');
  });
});
