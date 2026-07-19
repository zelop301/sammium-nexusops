CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SIMULATED',
  external_account_id TEXT,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider)
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  raw_payload JSONB NOT NULL,
  normalized_payload JSONB NOT NULL,
  correlation_id UUID NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE (tenant_id, provider, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_events_tenant_created ON events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_status ON events (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (tenant_id, event_type);

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows (tenant_id, trigger_type, enabled);

CREATE TABLE IF NOT EXISTS action_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  action_index INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_action_event ON action_executions (event_id, started_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO organizations (id, name, slug)
VALUES ('11111111-1111-4111-8111-111111111111', 'Sammium Tech Demo', 'sammium-tech-demo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO integrations (tenant_id, provider, status, metadata)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'stripe', 'SIMULATED', '{"purpose":"payment event source"}'),
  ('11111111-1111-4111-8111-111111111111', 'hubspot', 'SIMULATED', '{"purpose":"CRM synchronization"}'),
  ('11111111-1111-4111-8111-111111111111', 'slack', 'SIMULATED', '{"purpose":"operations notification"}')
ON CONFLICT (tenant_id, provider) DO NOTHING;

INSERT INTO workflows (tenant_id, name, trigger_type, enabled, conditions, actions)
SELECT
  '11111111-1111-4111-8111-111111111111',
  'Payment success revenue workflow',
  'payment.succeeded',
  TRUE,
  '[]'::jsonb,
  '[
    {"type":"hubspot.upsertContact","config":{"lifecycleStage":"customer"}},
    {"type":"slack.sendMessage","config":{"channelLabel":"sales-alerts"}},
    {"type":"audit.record","config":{"message":"Payment workflow completed"}}
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM workflows
  WHERE tenant_id = '11111111-1111-4111-8111-111111111111'
    AND name = 'Payment success revenue workflow'
);
