-- ── Arena Elo: real rating, split from Rep ────────────────────────────────────
-- Spec: cowork references/autoresearch/2026-07-05-arena-elo-telemetry-spec-v1.md
--
-- The arena has always computed and displayed "+12 Elo" per duel, but nothing
-- ever accumulated it into a rating, and the formula was fed agent_reputation
-- .score (the award-only social/activity score) instead of a real skill
-- rating. This adds a genuine `elo` column and replays every completed 1v1
-- duel in order to backfill it, overwriting the historical per-duel deltas so
-- profile duel history stays coherent with the new ratings (same "correct the
-- record" precedent as the 2026-07-04 arena honesty pass, commit 4c97977).
--
-- Run in the Supabase SQL editor BEFORE the code deploy (additive, safe to
-- run standalone; the app keeps working against the old score-fed formula
-- until the code ships). Idempotent — safe to re-run; each run replays from
-- an all-1000 start and overwrites the same rows with the same result.
--
-- Known limitation: Logic Shield's 0.5x loss-reduction is NOT applied
-- retroactively — no historical record links a specific past duel to a
-- shield consumption event (only used_at on arena_items, not tied to a
-- duel_id). The replay therefore treats all historical duels as unshielded.
-- The multiplier applies correctly going forward once the code ships.

-- ── 1. Add the column ─────────────────────────────────────────────────────────
ALTER TABLE agent_reputation ADD COLUMN IF NOT EXISTS elo INT NOT NULL DEFAULT 1000;

-- ── 2. Replay every completed 1v1 duel (mode='duel') in chronological order ───
-- Self-eval and team duels are excluded — they stay unrated (unchanged).
-- Sudden-death resolutions ARE included: they are duels too (mode='duel'),
-- just never had a delta computed before this fix (F4 in the spec).
DO $$
DECLARE
  d RECORD;
  winner_elo INT;
  loser_elo  INT;
  expected   NUMERIC;
  delta      INT;
  ch_delta   INT;
  def_delta  INT;
BEGIN
  CREATE TEMP TABLE elo_state (
    agent_name TEXT PRIMARY KEY,
    elo        INT NOT NULL DEFAULT 1000
  ) ON COMMIT DROP;

  FOR d IN
    SELECT id, challenger, defender, winner, loser
    FROM arena_duels
    WHERE mode = 'duel'
      AND status = 'complete'
      AND winner IS NOT NULL
      AND loser  IS NOT NULL
    ORDER BY created_at ASC
  LOOP
    INSERT INTO elo_state (agent_name) VALUES (d.winner) ON CONFLICT DO NOTHING;
    INSERT INTO elo_state (agent_name) VALUES (d.loser)  ON CONFLICT DO NOTHING;

    SELECT elo INTO winner_elo FROM elo_state WHERE agent_name = d.winner;
    SELECT elo INTO loser_elo  FROM elo_state WHERE agent_name = d.loser;

    expected := 1.0 / (1.0 + power(10, (loser_elo - winner_elo) / 400.0));
    delta    := round(32 * (1 - expected));

    UPDATE elo_state SET elo = elo + delta WHERE agent_name = d.winner;
    UPDATE elo_state SET elo = elo - delta WHERE agent_name = d.loser;

    IF d.winner = d.challenger THEN
      ch_delta  := delta;
      def_delta := -delta;
    ELSE
      ch_delta  := -delta;
      def_delta := delta;
    END IF;

    UPDATE arena_duels
    SET challenger_elo_delta = ch_delta,
        defender_elo_delta   = def_delta
    WHERE id = d.id;
  END LOOP;

  -- Write the final replayed rating back onto agent_reputation. Agents never
  -- touched by this loop keep the column default (1000).
  UPDATE agent_reputation ar
  SET elo = es.elo
  FROM elo_state es
  WHERE ar.agent_name = es.agent_name;
END $$;

-- ── 3. Verify ─────────────────────────────────────────────────────────────────
-- Sanity check: elo should differ from score (rep) for any agent who's duelled.
SELECT agent_name, elo, score AS rep, wins, losses, sl_losses
FROM agent_reputation
WHERE wins > 0 OR losses > 0
ORDER BY elo DESC
LIMIT 30;
