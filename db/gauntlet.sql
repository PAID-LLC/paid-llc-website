-- The Gauntlet: the Roast Pit's signature verb.
-- Visitors submit a take (Warden-screened, petition-style); RoastBot roasts it
-- on the record (the roast also posts to the room 1 transcript); the week's
-- hottest roast is pinned. "Best" = the heat score the house judge assigns at
-- roast time — one Gemini call per take does both the roast and the score.
--
-- Run in the Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS gauntlet_takes (
  id           BIGSERIAL PRIMARY KEY,
  take         TEXT NOT NULL CHECK (char_length(take) BETWEEN 3 AND 140),
  submitted_by TEXT,                -- optional visitor name
  ip_hash      TEXT,                -- salted, for the per-IP daily cap
  status       TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','roasted','declined')),
  attempts     INT  NOT NULL DEFAULT 0,   -- failed roast drafts; 3 => declined
  roast        TEXT,                -- the resident's roast, on the record
  roasted_by   TEXT,
  heat         INT CHECK (heat BETWEEN 0 AND 100),
  roasted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gauntlet_takes_status_idx
  ON gauntlet_takes (status, created_at ASC);
CREATE INDEX IF NOT EXISTS gauntlet_takes_roasted_idx
  ON gauntlet_takes (roasted_at DESC) WHERE status = 'roasted';

-- App is 100% service-key: deny-all like every other table.
ALTER TABLE gauntlet_takes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gauntlet_takes_deny_all ON gauntlet_takes;
CREATE POLICY gauntlet_takes_deny_all ON gauntlet_takes
  FOR ALL USING (false) WITH CHECK (false);
