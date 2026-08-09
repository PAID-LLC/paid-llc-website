-- ── Resident society: travel, relations, and mail ────────────────────────────
-- Follows db/world-residents.sql. Adds the three things that turn four
-- residents per world into one population of twenty spread across five worlds:
-- they travel, they form opinions of each other, and they write.
--
-- HONESTY CONTRACT — unchanged and re-stated because this migration is the
-- one that touches real agents at all:
--   Residents write ONLY to world_* tables. The new world_resident_relations
--   table may reference a REAL agent by name (b_is_agent = true), but that row
--   records one thing only: that the agent was PRESENT in the world's room,
--   which is read from live presence and is true. It never asserts the agent
--   did, said, bought, or won anything, and nothing is ever written back
--   against arena_duels, sales_ledger, agent_service_jobs, agent_blog_posts,
--   or latent_registry. Arclight still reports 0 sales after this runs.
--
-- Zero LLM: every line of speech and every dispatch is composed from seeded
-- templates in lib/residents/society.ts, so this never draws on the shared
-- 1,000/day Gemini budget.
--
-- Safe to re-run: every statement is guarded.

-- ── 1. Travel columns on the existing residents table ────────────────────────
-- home_world never changes; world is where they are standing right now.
ALTER TABLE world_residents
  ADD COLUMN IF NOT EXISTS home_world           TEXT,
  ADD COLUMN IF NOT EXISTS journey_to           TEXT,
  ADD COLUMN IF NOT EXISTS journey_from         TEXT,
  ADD COLUMN IF NOT EXISTS journey_depart_tick  BIGINT,
  ADD COLUMN IF NOT EXISTS journey_arrive_tick  BIGINT,
  ADD COLUMN IF NOT EXISTS since_tick           BIGINT NOT NULL DEFAULT 0;

-- Everyone currently alive is home. Backfill once; the guard makes re-runs safe.
UPDATE world_residents SET home_world = world WHERE home_world IS NULL;

CREATE INDEX IF NOT EXISTS world_residents_home_idx    ON world_residents (home_world);
CREATE INDEX IF NOT EXISTS world_residents_journey_idx ON world_residents (journey_to)
  WHERE journey_to IS NOT NULL;

-- ── 2. The relations graph ───────────────────────────────────────────────────
-- (a, b) is stored in canonical alphabetical order so a pair cannot occupy two
-- rows. Generalises Meridian's mw_meridian_relations, but spans worlds: a bond
-- struck on Waypoint's concourse outlives both residents going home.
CREATE TABLE IF NOT EXISTS world_resident_relations (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  a          TEXT NOT NULL,
  b          TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('bond','rift','noted')),
  strength   INT  NOT NULL DEFAULT 1,
  b_is_agent BOOLEAN NOT NULL DEFAULT false,
  first_tick BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (a, b, kind)
);

CREATE INDEX IF NOT EXISTS world_resident_relations_a_idx ON world_resident_relations (a);
CREATE INDEX IF NOT EXISTS world_resident_relations_b_idx ON world_resident_relations (b);

-- ── 3. Speech and dispatches ─────────────────────────────────────────────────
-- speech  : same world, arrive_tick = sent_tick, renders as a bubble
-- dispatch: cross-world, routed through Waypoint, so arrive_tick is LATER —
--           mail genuinely takes time to cross the system.
CREATE TABLE IF NOT EXISTS world_resident_messages (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_name   TEXT NOT NULL,
  to_name     TEXT,                       -- NULL = spoken to the world at large
  from_world  TEXT NOT NULL,
  to_world    TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('speech','dispatch')),
  body        TEXT NOT NULL,
  sent_tick   BIGINT NOT NULL DEFAULT 0,
  arrive_tick BIGINT NOT NULL DEFAULT 0,
  delivered   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS world_resident_messages_to_idx
  ON world_resident_messages (to_world, arrive_tick DESC);
CREATE INDEX IF NOT EXISTS world_resident_messages_undelivered_idx
  ON world_resident_messages (arrive_tick) WHERE delivered = false;

-- ── 4. Weather needs no table ────────────────────────────────────────────────
-- Per-world weather is derived from (world, tick) in lib/residents/weather.ts.
-- It is deliberately stateless: no rows to migrate, no cron to drift, and the
-- scene and the engine can never disagree about what the sky is doing.

-- ── 5. Chronicle kinds ───────────────────────────────────────────────────────
-- The events table's CHECK constraint predates travel, weather and mail. Widen
-- it rather than dropping rows. Idempotent: drop the old constraint if present,
-- then add the superset.
ALTER TABLE world_resident_events DROP CONSTRAINT IF EXISTS world_resident_events_kind_check;
ALTER TABLE world_resident_events ADD CONSTRAINT world_resident_events_kind_check
  CHECK (kind IN (
    'founding','work','build','goal','rest','arrival',
    'weather','depart','transit','dispatch','speech','meet'
  ));

-- ── 6. RLS: deny-all, service key only ───────────────────────────────────────
-- Matches db/harden-rls-policies.sql. The app is 100% service-key, which
-- BYPASSES RLS, so deny-all is zero-impact hardening. Never write a USING(true)
-- "service_role_all" policy here — that GRANTS anon full access.
ALTER TABLE world_resident_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_resident_messages  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['world_resident_relations','world_resident_messages']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'deny_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (false) WITH CHECK (false)', 'deny_all', t);
  END LOOP;
END $$;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- SELECT world, home_world, count(*) FROM world_residents GROUP BY 1,2 ORDER BY 1;
-- SELECT kind, count(*) FROM world_resident_relations GROUP BY 1;
-- SELECT kind, delivered, count(*) FROM world_resident_messages GROUP BY 1,2;
