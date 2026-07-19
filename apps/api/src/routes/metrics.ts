import type { FastifyInstance } from 'fastify';
import { query } from '../db.js';
import { getTenantId } from '../tenant.js';
import { config } from '../config.js';

export async function metricRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/metrics/summary', async (request) => {
    const tenantId = getTenantId(request);
    const counts = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM events WHERE tenant_id = $1 GROUP BY status`,
      [tenantId]
    );
    const today = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM events WHERE tenant_id = $1 AND created_at >= date_trunc('day', NOW())`,
      [tenantId]
    );
    const processing = await query<{ average_ms: number | null }>(
      `SELECT AVG(EXTRACT(EPOCH FROM (processed_at - created_at)) * 1000)::float AS average_ms
       FROM events WHERE tenant_id = $1 AND processed_at IS NOT NULL`,
      [tenantId]
    );
    const statusCounts = Object.fromEntries(counts.map((item) => [item.status, Number(item.count)]));
    return {
      totalToday: Number(today[0]?.count ?? 0),
      succeeded: statusCounts.SUCCEEDED ?? 0,
      failed: (statusCounts.FAILED ?? 0) + (statusCounts.DEAD_LETTER ?? 0),
      queued: (statusCounts.QUEUED ?? 0) + (statusCounts.PROCESSING ?? 0),
      averageProcessingMs: Math.round(processing[0]?.average_ms ?? 0),
      connectors: [
        { name: 'Stripe', connected: Boolean(config.STRIPE_SECRET_KEY), mode: config.STRIPE_SECRET_KEY ? 'live-test' : 'demo' },
        { name: 'HubSpot', connected: Boolean(config.HUBSPOT_ACCESS_TOKEN), mode: config.HUBSPOT_ACCESS_TOKEN ? 'connected' : 'simulated' },
        { name: 'Slack', connected: Boolean(config.SLACK_WEBHOOK_URL), mode: config.SLACK_WEBHOOK_URL ? 'connected' : 'simulated' }
      ]
    };
  });
}
