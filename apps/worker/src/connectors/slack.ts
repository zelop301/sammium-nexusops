import type { CanonicalEvent } from '@nexus/contracts';
import { config } from '../config.js';

export async function sendSlackMessage(event: CanonicalEvent, actionConfig: Record<string, unknown>) {
  const amount = Number(event.data.amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const text = [
    '✅ *NexusOps payment workflow completed*',
    `• Customer: ${event.data.name ?? event.data.email ?? event.subject}`,
    `• Amount: ${event.data.currency ?? 'PHP'} ${amount}`,
    `• Event: ${event.type}`,
    `• Correlation ID: ${event.correlationId}`,
    `• Channel label: ${actionConfig.channelLabel ?? 'operations'}`
  ].join('\n');

  if (!config.SLACK_WEBHOOK_URL) {
    return { mode: 'simulated', provider: 'slack', text };
  }

  const response = await fetch(config.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!response.ok) throw new Error(`Slack webhook failed with ${response.status}: ${await response.text()}`);
  return { mode: 'connected', provider: 'slack', delivered: true };
}
