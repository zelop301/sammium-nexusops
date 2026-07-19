import type { CanonicalEvent } from '@nexus/contracts';
import { query } from '../db.js';

export interface StoredEvent {
  id: string;
  tenant_id: string;
  provider: string;
  external_event_id: string;
  event_type: string;
  status: string;
  raw_payload: Record<string, unknown>;
  normalized_payload: CanonicalEvent;
  correlation_id: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

export async function createEvent(params: {
  tenantId: string;
  provider: string;
  externalEventId: string;
  eventType: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload: CanonicalEvent;
}): Promise<{ event: StoredEvent; duplicate: boolean }> {
  const inserted = await query<StoredEvent>(
    `INSERT INTO events (
      id, tenant_id, provider, external_event_id, event_type, status,
      raw_payload, normalized_payload, correlation_id
    ) VALUES ($1, $2, $3, $4, $5, 'QUEUED', $6::jsonb, $7::jsonb, $8)
    ON CONFLICT (tenant_id, provider, external_event_id) DO NOTHING
    RETURNING *`,
    [
      params.normalizedPayload.id,
      params.tenantId,
      params.provider,
      params.externalEventId,
      params.eventType,
      JSON.stringify(params.rawPayload),
      JSON.stringify(params.normalizedPayload),
      params.normalizedPayload.correlationId
    ]
  );

  if (inserted[0]) return { event: inserted[0], duplicate: false };

  const existing = await query<StoredEvent>(
    `SELECT * FROM events WHERE tenant_id = $1 AND provider = $2 AND external_event_id = $3 LIMIT 1`,
    [params.tenantId, params.provider, params.externalEventId]
  );
  if (!existing[0]) throw new Error('Event conflict detected but existing event could not be loaded.');
  return { event: existing[0], duplicate: true };
}
