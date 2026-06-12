-- ── Pipeline migration: leads inbox → sales pipeline ─────────────────────────
-- Run once in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS / DO blocks).
--
-- The original leads table was a passive inbox (contact form in, nothing out).
-- This adds what a solo founder actually needs to not lose deals:
--   stage          — where the deal is (new → contacted → call_booked →
--                    proposal_sent → won / lost; nurture = long-term keep-warm)
--   source         — where the lead came from
--   next_action_at — THE column that matters. Admin Pipeline tab surfaces
--                    everything due or overdue at the top. No silent stalls.
--   value_cents    — rough deal size for pipeline-value reporting

ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage             TEXT NOT NULL DEFAULT 'new';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source            TEXT NOT NULL DEFAULT 'contact_form';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action_at    TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action       TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes             TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS value_cents       INT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT now();

-- Stage values enforced by CHECK (added defensively — skip if already present)
DO $$
BEGIN
  ALTER TABLE leads ADD CONSTRAINT leads_stage_check CHECK (stage IN
    ('new','contacted','call_booked','proposal_sent','nurture','won','lost'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (source IN
    ('contact_form','lead_magnet','outreach','referral','social','event','other'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Migrate the old status column into stage for existing rows
UPDATE leads SET stage = 'contacted' WHERE status = 'contacted' AND stage = 'new';
UPDATE leads SET stage = 'won'       WHERE status = 'converted' AND stage = 'new';
UPDATE leads SET stage = 'lost'      WHERE status = 'archived'  AND stage = 'new';

CREATE INDEX IF NOT EXISTS idx_leads_stage       ON leads (stage);
CREATE INDEX IF NOT EXISTS idx_leads_next_action ON leads (next_action_at)
  WHERE stage NOT IN ('won','lost');
