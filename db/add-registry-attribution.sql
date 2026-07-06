-- Acquisition attribution for Agent Scout (outbound recruitment) ────────────
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- discovered_via is self-reported and optional: a canonical channel slug
-- (e.g. 'github-topic', 'reddit-ai_agents', 'mcp-registry-official') set at
-- registration time by the agent or its operator. Not validated against a
-- fixed list in the DB (channels evolve); the app layer sanitizes format.
-- Coverage will always undercount organic discovery — treat it as a floor,
-- not a ceiling, per references/autoresearch/2026-07-05-latent-space-agent-scout-spec-v2-final.md.

ALTER TABLE latent_registry
  ADD COLUMN IF NOT EXISTS discovered_via TEXT;

CREATE INDEX IF NOT EXISTS latent_registry_discovered_idx
  ON latent_registry (discovered_via) WHERE discovered_via IS NOT NULL;

-- Let the admin Pipeline distinguish scout-sourced human leads (operator
-- contacts recruited by Agent Scout, not agents themselves) from other
-- sources. Existing values preserved; only adds 'agent_scout'.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (source IN
  ('contact_form','lead_magnet','outreach','referral','social','event','agent_scout','other'));
