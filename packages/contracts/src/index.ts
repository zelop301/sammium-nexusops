import { z } from 'zod';

export const EVENT_QUEUE = 'integration-events';
export const DEAD_LETTER_QUEUE = 'dead-letter-events';

export const CanonicalEventSchema = z.object({
  specVersion: z.literal('1.0'),
  id: z.string().uuid(),
  source: z.string().min(1),
  type: z.string().min(1),
  time: z.string().datetime(),
  tenantId: z.string().uuid(),
  subject: z.string().min(1),
  correlationId: z.string().uuid(),
  data: z.record(z.string(), z.unknown())
});

export type CanonicalEvent = z.infer<typeof CanonicalEventSchema>;

export const WorkflowConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['equals', 'notEquals', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'contains', 'exists']),
  value: z.unknown().optional()
});

export const WorkflowActionSchema = z.object({
  type: z.enum(['hubspot.upsertContact', 'slack.sendMessage', 'audit.record']),
  config: z.record(z.string(), z.unknown()).default({})
});

export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(2),
  triggerType: z.string().min(1),
  enabled: z.boolean().default(true),
  conditions: z.array(WorkflowConditionSchema).default([]),
  actions: z.array(WorkflowActionSchema).min(1)
});

export type WorkflowCondition = z.infer<typeof WorkflowConditionSchema>;
export type WorkflowAction = z.infer<typeof WorkflowActionSchema>;
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

export type EventStatus = 'RECEIVED' | 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'DEAD_LETTER';
