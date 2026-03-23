-- MCP/UCP Phase 1: Agent Commerce Audit Log
-- Run in Supabase SQL Editor

CREATE TABLE agent_commerce_log (
  id          BIGSERIAL    PRIMARY KEY,
  agent_name  TEXT         NOT NULL,
  action      TEXT         NOT NULL
    CHECK (action IN ('discovery','negotiate','purchase','download','bulk_request','counter_offer')),
  resource_id TEXT,
  amount      NUMERIC(10,2),
  currency    TEXT         NOT NULL DEFAULT 'USD',
  status      TEXT         NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated','accepted','rejected','completed','failed')),
  metadata    JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX acl_agent_idx  ON agent_commerce_log (agent_name, created_at DESC);
CREATE INDEX acl_action_idx ON agent_commerce_log (action, status);

ALTER TABLE agent_commerce_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON agent_commerce_log USING (true) WITH CHECK (true);
