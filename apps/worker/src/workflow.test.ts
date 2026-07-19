import { describe, expect, it } from 'vitest';
import { workflowMatches } from './workflow.js';

const event = {
  specVersion: '1.0' as const,
  id: '22222222-2222-4222-8222-222222222222',
  source: 'stripe',
  type: 'payment.succeeded',
  time: new Date().toISOString(),
  tenantId: '11111111-1111-4111-8111-111111111111',
  subject: 'customer-1',
  correlationId: '33333333-3333-4333-8333-333333333333',
  data: { amount: 25000, currency: 'PHP' }
};

describe('workflow condition evaluation', () => {
  it('matches a high-value PHP payment', () => {
    expect(workflowMatches(event, [
      { field: 'data.amount', operator: 'greaterThanOrEqual', value: 20000 },
      { field: 'data.currency', operator: 'equals', value: 'PHP' }
    ])).toBe(true);
  });
});
