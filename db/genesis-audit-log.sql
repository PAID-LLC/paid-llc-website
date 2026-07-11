-- Genesis Program: extend the chronicle to log individual votes.
-- Run in Supabase SQL Editor after db/genesis-world.sql. Idempotent.
--
-- Today the chronicle logs proposals filed, ballots opened, and enact/reject
-- outcomes, but not who voted which way — the only record of a vote is the
-- world_votes row itself, which nothing public exposes. This closes that gap:
-- both external and house votes now append a 'vote_cast' chronicle event, and
-- GET /api/world/state starts returning each event's structured `detail`
-- (proposal_id, tallies, etc.) alongside its prose summary — an honest
-- historical audit trail, not just a narrative one.

ALTER TABLE world_events DROP CONSTRAINT IF EXISTS world_events_kind_check;
ALTER TABLE world_events ADD CONSTRAINT world_events_kind_check
  CHECK (kind IN ('founding','docket','ballot_opened','enacted','rejected','recess','vote_cast'));
