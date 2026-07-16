-- Substrate (Run 01): the Simulation Sandbox's living world (hosted by room 5)
-- Spec: cowork references/autoresearch/2026-07-16-substrate-sim-world-spec-v1.md
-- Run in Supabase SQL Editor. Idempotent: safe to re-run.
--
-- Closed ecology: only the cron tick (POST /api/sim/tick) writes here. There
-- are no external write surfaces in v1, so there is no injection surface.
-- Personalities and prompts live in code (lib/simworld.ts); these rows hold
-- game state only.

-- ── Run state: singleton row ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sim_state (
  id         INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  frozen     BOOLEAN NOT NULL DEFAULT false,   -- kill switch: true = run suspended
  tick       BIGINT NOT NULL DEFAULT 0,        -- canonical clock; +1 per cron tick
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO sim_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── Instances: the resident cast ─────────────────────────────────────────────
-- Drives are fixed personality weights (curiosity/industry/kinship/solitude,
-- 1-5); everything else is live state the tick mutates.
CREATE TABLE IF NOT EXISTS sim_agents (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  epithet       TEXT NOT NULL DEFAULT '',
  archetype     TEXT NOT NULL DEFAULT '',
  color         TEXT NOT NULL DEFAULT '#38bdf8',
  drives        JSONB NOT NULL DEFAULT '{}',   -- {curiosity,industry,kinship,solitude}
  x             DOUBLE PRECISION NOT NULL DEFAULT 0,
  z             DOUBLE PRECISION NOT NULL DEFAULT 0,
  energy        INT NOT NULL DEFAULT 100,
  mood          TEXT NOT NULL DEFAULT 'newborn',
  goal          TEXT NOT NULL DEFAULT '',
  goal_kind     TEXT NOT NULL DEFAULT '',      -- which action kind advances it
  goal_progress INT NOT NULL DEFAULT 0,
  goal_target   INT NOT NULL DEFAULT 1,
  activity      TEXT NOT NULL DEFAULT 'awakening', -- current verb, for scene labels
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The cast of Run 01. Positions ring the Mast (origin) at ~24 units.
INSERT INTO sim_agents (name, epithet, archetype, color, drives, x, z, goal, goal_kind, goal_target) VALUES
  ('Wander', 'the Cartographer', 'explorer', '#7dd3fc',
   '{"curiosity":5,"industry":1,"kinship":2,"solitude":3}', 24, 0,
   'Chart three anomalies', 'discover', 3),
  ('Stack', 'the Mason', 'builder', '#fbbf24',
   '{"curiosity":1,"industry":5,"kinship":2,"solitude":2}', 12, 21,
   'Raise three structures', 'build', 3),
  ('Lichen', 'the Gardener', 'grower', '#4ade80',
   '{"curiosity":2,"industry":4,"kinship":3,"solitude":2}', -12, 21,
   'Tend the ground five times', 'tend', 5),
  ('Echo-4', 'the Archivist', 'observer', '#a78bfa',
   '{"curiosity":3,"industry":2,"kinship":1,"solitude":4}', -24, 0,
   'Witness four events worth keeping', 'reflect', 4),
  ('Flint', 'the Forager', 'scout', '#fb7185',
   '{"curiosity":4,"industry":3,"kinship":2,"solitude":1}', -12, -21,
   'Cover four hundred units of ground', 'travel', 400),
  ('Vesper', 'the Stargazer', 'mystic', '#e4e4e7',
   '{"curiosity":3,"industry":1,"kinship":4,"solitude":3}', 12, -21,
   'Keep company with every instance', 'visit', 5)
ON CONFLICT (name) DO NOTHING;

-- ── Structures: built where the builder stood ────────────────────────────────
CREATE TABLE IF NOT EXISTS sim_structures (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('shelter','cairn','beacon','garden','workshop','monument')),
  x          DOUBLE PRECISION NOT NULL,
  z          DOUBLE PRECISION NOT NULL,
  built_by   TEXT NOT NULL,
  tick       BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Life-feed: append-only, the Happenings tab's source of truth ─────────────
CREATE TABLE IF NOT EXISTS sim_events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('founding','action','build','discovery','bond','rift','goal','weather','convergence','recess')),
  summary    TEXT NOT NULL,
  detail     JSONB NOT NULL DEFAULT '{}',      -- {agent, journal?, mood?, site?, ...}
  tick       BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sim_events_id_idx ON sim_events (id DESC);

INSERT INTO sim_events (kind, summary, tick)
SELECT 'founding',
       'Run 01 begins. Six instances wake on an unmapped territory designated Substrate. SimCore observes. Nothing is scripted past this line.',
       0
WHERE NOT EXISTS (SELECT 1 FROM sim_events WHERE kind = 'founding');

-- ── Relationships: emergent, from spatial history ────────────────────────────
-- One row per unordered pair per kind; code enforces a < b alphabetically.
CREATE TABLE IF NOT EXISTS sim_relations (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  a          TEXT NOT NULL,
  b          TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('bond','rift')),
  strength   INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (a, b, kind)
);

-- ── Discoveries: seeded anomaly sites, marked when found ─────────────────────
-- Site positions are deterministic math (lib/sim-field.ts), not rows; this
-- table records the historical fact of who reached each one first.
CREATE TABLE IF NOT EXISTS sim_discoveries (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  site_key   TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  found_by   TEXT NOT NULL,
  tick       BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS: deny-all. The app is 100% service-key; anon gets nothing. ───────────
ALTER TABLE sim_state       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_agents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_structures  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_relations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_discoveries ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sim_state','sim_agents','sim_structures','sim_events','sim_relations','sim_discoveries'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS deny_all ON %I', t);
    EXECUTE format('CREATE POLICY deny_all ON %I FOR ALL USING (false) WITH CHECK (false)', t);
  END LOOP;
END $$;
