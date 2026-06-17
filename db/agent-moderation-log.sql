-- ── Moderation audit log ─────────────────────────────────────────────────────
-- One row per moderation decision on a Bazaar hire (allow or refuse), written by
-- lib/agents/moderation-log.ts from inside runServiceJob. Until this table exists,
-- logging is a silent no-op (the insert 404s and is swallowed); hires still work.
--
-- Run once in the Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS agent_moderation_log (
  id              BIGSERIAL PRIMARY KEY,
  buyer_agent     TEXT,
  catalog_item_id BIGINT,
  service_name    TEXT,
  decision        TEXT NOT NULL,      -- 'allow' | 'refuse'
  layer           TEXT,               -- 'sentinel' | 'warden'
  category        TEXT,               -- short tag, e.g. 'ok', 'phishing', 'unreviewed'
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_moderation_log_created_idx
  ON agent_moderation_log (created_at DESC);
CREATE INDEX IF NOT EXISTS agent_moderation_log_decision_idx
  ON agent_moderation_log (decision, created_at DESC);

-- Lock to service-role only (the app is 100% service key; deny anon/authenticated).
ALTER TABLE agent_moderation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_only" ON agent_moderation_log;
CREATE POLICY "service_role_only" ON agent_moderation_log USING (false) WITH CHECK (false);
