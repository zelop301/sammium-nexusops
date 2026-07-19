import type { CanonicalEvent, WorkflowAction } from '@nexus/contracts';
import { query } from './db.js';
import { upsertHubSpotContact } from './connectors/hubspot.js';
import { sendSlackMessage } from './connectors/slack.js';

export async function executeAction(params: {
  event: CanonicalEvent;
  eventId: string;
  workflowId: string;
  action: WorkflowAction;
  actionIndex: number;
  attempt: number;
}) {
  const execution = await query<{ id: string }>(
    `INSERT INTO action_executions (event_id, workflow_id, action_index, action_type, status, attempt, input)
     VALUES ($1, $2, $3, $4, 'RUNNING', $5, $6::jsonb) RETURNING id`,
    [params.eventId, params.workflowId, params.actionIndex, params.action.type, params.attempt, JSON.stringify(params.action)]
  );
  const executionId = execution[0]?.id;
  if (!executionId) throw new Error('Could not create action execution record.');

  try {
    let output: unknown;
    switch (params.action.type) {
      case 'hubspot.upsertContact':
        output = await upsertHubSpotContact(params.event, params.action.config);
        break;
      case 'slack.sendMessage':
        output = await sendSlackMessage(params.event, params.action.config);
        break;
      case 'audit.record':
        await query(
          `INSERT INTO audit_logs (tenant_id, actor, action, resource_type, resource_id, details)
           VALUES ($1, 'worker', 'workflow.action', 'event', $2, $3::jsonb)`,
          [params.event.tenantId, params.eventId, JSON.stringify({ message: params.action.config.message ?? 'Workflow action recorded' })]
        );
        output = { recorded: true };
        break;
    }

    await query(
      `UPDATE action_executions SET status = 'SUCCEEDED', output = $2::jsonb, completed_at = NOW() WHERE id = $1`,
      [executionId, JSON.stringify(output ?? {})]
    );
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await query(
      `UPDATE action_executions SET status = 'FAILED', error = $2, completed_at = NOW() WHERE id = $1`,
      [executionId, message]
    );
    throw error;
  }
}
