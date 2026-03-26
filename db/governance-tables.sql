-- ── Governance Pod: Audit Log + Agent Permissions ─────────────────────────────
-- Run in Supabase SQL editor. Safe to re-run: uses IF NOT EXISTS.

-- Layer 3: Auditor — agent_audit_log
-- SHA-256 hash of args only. Raw input is never stored.
CREATE TABLE IF NOT EXISTS agent_audit_log (
  id           BIGSERIAL PRIMARY KEY,
  agent_name   TEXT NOT NULL DEFAULT 'anonymous',
  tool_name    TEXT NOT NULL,
  input_sha256 TEXT NOT NULL,
  result_code  TEXT NOT NULL,
  ip_hash      TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE agent_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON agent_audit_log
  USING (false) WITH CHECK (false);
CREATE INDEX IF NOT EXISTS idx_audit_agent_tool
  ON agent_audit_log (agent_name, tool_name, created_at DESC);

-- Layer 2: Warden — agent_permissions (per-agent block table)
-- Used for emergency agent bans; checked by policy-warden.ts when needed.
CREATE TABLE IF NOT EXISTS agent_permissions (
  agent_name  TEXT PRIMARY KEY,
  blocked     BOOLEAN DEFAULT FALSE,
  blocked_at  TIMESTAMPTZ,
  reason      TEXT
);
ALTER TABLE agent_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON agent_permissions
  USING (false) WITH CHECK (false);

-- Retention: delete audit logs older than 90 days (run as a scheduled job).
-- DELETE FROM agent_audit_log WHERE created_at < now() - interval '90 days';
