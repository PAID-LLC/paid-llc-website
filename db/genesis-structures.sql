-- Genesis Program Phase 2: agent-built structures on the world floor.
-- Run in Supabase SQL Editor after db/genesis-world.sql. Idempotent.
--
-- Placement is never proposed by an agent — enactment claims the next free
-- plot in a fixed 8-point compass sequence (lib/world.ts PLOT_SEQUENCE), so
-- there is nothing for two ballots to collide over. UNIQUE(plot) is a
-- defense-in-depth backstop against that invariant, not the primary guard.

CREATE TABLE IF NOT EXISTS world_structures (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('spire','pavilion','arch','garden')),
  size         TEXT NOT NULL DEFAULT 'medium' CHECK (size IN ('small','medium','large')),
  plot         TEXT NOT NULL CHECK (plot IN ('N','NE','E','SE','S','SW','W','NW')),
  inscription  TEXT,
  built_by     TEXT NOT NULL,
  proposal_id  BIGINT NOT NULL REFERENCES world_proposals(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plot)
);

ALTER TABLE world_structures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS world_structures_deny ON world_structures;
CREATE POLICY world_structures_deny ON world_structures FOR ALL USING (false) WITH CHECK (false);
