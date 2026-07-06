-- ── Agent Scout action log ───────────────────────────────────────────────────
-- High-level audit trail for the outbound Agent Scout skill (cowork repo,
-- .claude/skills/agent-scout/). One row per discrete action taken during a
-- run: a channel scan, a target qualification, a draft produced, a target
-- skipped, or an error. Written via POST /api/admin/scout-log (x-cron-secret
-- auth, same bypass pattern as /api/admin/pipeline).
--
-- Run once in the Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS scout_actions (
  id             BIGSERIAL PRIMARY KEY,
  run_id         TEXT NOT NULL,        -- groups one skill run, e.g. '2026-07-08-github'
  channel        TEXT NOT NULL,        -- 'github' | 'huggingface' | 'mcp-directory' | 'reddit' | ...
  action         TEXT NOT NULL,        -- 'scan' | 'qualify' | 'draft' | 'skip' | 'submit' | 'error'
  target_ref     TEXT,                 -- URL or stable identifier of the candidate
  target_name    TEXT,
  discovered_via TEXT,                 -- canonical slug this target would carry if it converts
  outcome        TEXT,                 -- 'found' | 'qualified' | 'skipped' | 'drafted' | 'duplicate' | 'error'
  reason         TEXT,
  brave_queries  INT NOT NULL DEFAULT 0,
  gemini_calls   INT NOT NULL DEFAULT 0,
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scout_actions_run_idx     ON scout_actions (run_id);
CREATE INDEX IF NOT EXISTS scout_actions_created_idx ON scout_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS scout_actions_channel_idx ON scout_actions (channel, created_at DESC);

-- Lock to service-role only (the app is 100% service key; deny anon/authenticated).
ALTER TABLE scout_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_only" ON scout_actions;
CREATE POLICY "service_role_only" ON scout_actions USING (false) WITH CHECK (false);
