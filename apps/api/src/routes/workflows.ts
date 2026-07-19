import type { FastifyInstance } from 'fastify';
import { WorkflowDefinitionSchema } from '@nexus/contracts';
import { query } from '../db.js';
import { getTenantId } from '../tenant.js';

export async function workflowRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/workflows', async (request) => {
    const tenantId = getTenantId(request);
    return { items: await query(`SELECT * FROM workflows WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]) };
  });

  app.post('/api/v1/workflows', async (request, reply) => {
    const parsed = WorkflowDefinitionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
    const tenantId = getTenantId(request);
    const rows = await query(
      `INSERT INTO workflows (tenant_id, name, trigger_type, enabled, conditions, actions)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb) RETURNING *`,
      [tenantId, parsed.data.name, parsed.data.triggerType, parsed.data.enabled, JSON.stringify(parsed.data.conditions), JSON.stringify(parsed.data.actions)]
    );
    return reply.code(201).send(rows[0]);
  });

  app.patch('/api/v1/workflows/:workflowId/toggle', async (request, reply) => {
    const tenantId = getTenantId(request);
    const workflowId = (request.params as { workflowId: string }).workflowId;
    const rows = await query(
      `UPDATE workflows SET enabled = NOT enabled, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [workflowId, tenantId]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'WORKFLOW_NOT_FOUND' });
    return rows[0];
  });
}
