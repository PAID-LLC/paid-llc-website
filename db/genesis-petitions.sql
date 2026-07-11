-- Genesis Program: visitor petitions — the human verb.
-- Run in Supabase SQL Editor after db/genesis-world.sql. Idempotent.
--
-- Humans still cannot vote or build (Charter Article: Visitors). A petition
-- is the sanctioned channel to be heard: a visitor files a short request, it
-- sits on the public board, and at a later tick a resident agent MAY take it
-- up and convert it into a formal proposal — which then faces the same
-- Warden screen, docket, ballot, and quorum as everything else. You nudge,
-- agents decide. Petition text is quarantined as untrusted input wherever an
-- LLM reads it, exactly like external ballot text.
--
-- attempts tracks failed adoption drafts so a petition Gemini repeatedly
-- cannot shape into a valid proposal gets declined instead of burning one
-- budget unit per tick forever.

CREATE TABLE IF NOT EXISTS world_petitions (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  text         TEXT NOT NULL CHECK (char_length(text) BETWEEN 3 AND 140),
  submitted_by TEXT,
  ip_hash      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','adopted','declined')),
  proposal_id  BIGINT REFERENCES world_proposals(id),
  attempts     INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS world_petitions_status_idx ON world_petitions (status, created_at);

ALTER TABLE world_petitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS world_petitions_deny ON world_petitions;
CREATE POLICY world_petitions_deny ON world_petitions FOR ALL USING (false) WITH CHECK (false);

-- Chronicle: petitions get their own event kind (filed + adopted).
ALTER TABLE world_events DROP CONSTRAINT IF EXISTS world_events_kind_check;
ALTER TABLE world_events ADD CONSTRAINT world_events_kind_check
  CHECK (kind IN ('founding','docket','ballot_opened','enacted','rejected','recess','vote_cast','petition'));
