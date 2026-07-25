-- ── World Residents: internal life for the five compile-class worlds ─────────
-- Spec: cowork references/autoresearch/2026-07-25-world-residents-spec-v1.md
--
-- Arclight, the Crucible, Palimpsest, the Lathe and Waypoint are compiler
-- worlds: they render real platform data (sales, duels, theses, commits) and
-- go dark when that data is empty. A 2026-07-25 audit found three of them dark
-- for 12-20 days and one that had never recorded traffic at all.
--
-- This adds a SEPARATE simulation layer: each world gets four residents who
-- move, work, and build inside it on the shared 30-minute world tick.
--
-- HONESTY CONTRACT — the reason this is its own table set:
--   Residents NEVER write to arena_duels, sales_ledger, agent_service_jobs,
--   agent_blog_posts, latent_registry, or any other table carrying real
--   business or agent activity. Arclight still reports 0 sales after this
--   runs. Waypoint's Departure Board still shows dark gates for worlds whose
--   real sources are empty. Fabricated arena duels were deliberately purged
--   from this platform once already; this layer does not walk that back.
--
-- Zero LLM cost: the engine is fully deterministic, so it never competes for
-- the shared 1,000/day Gemini budget and never stalls when that budget is out.
--
-- Safe to re-run: every CREATE is IF NOT EXISTS and every seed is guarded.

-- ── 1. Per-world clock + kill switch ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS world_resident_state (
  world      TEXT PRIMARY KEY,
  frozen     BOOLEAN NOT NULL DEFAULT false,   -- kill switch: true = suspended
  tick       BIGINT  NOT NULL DEFAULT 0,       -- canonical clock, +1 per cron tick
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO world_resident_state (world)
SELECT w FROM (VALUES ('arclight'),('crucible'),('palimpsest'),('lathe'),('waypoint')) AS t(w)
WHERE NOT EXISTS (SELECT 1 FROM world_resident_state s WHERE s.world = t.w);

-- ── 2. The residents ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS world_residents (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  world         TEXT NOT NULL,
  name          TEXT NOT NULL,
  epithet       TEXT NOT NULL DEFAULT '',
  archetype     TEXT NOT NULL DEFAULT '',
  color         TEXT NOT NULL DEFAULT '#38bdf8',
  drives        JSONB NOT NULL DEFAULT '{}',   -- {industry,curiosity,order,vigor}
  x             DOUBLE PRECISION NOT NULL DEFAULT 0,
  z             DOUBLE PRECISION NOT NULL DEFAULT 0,
  energy        INT  NOT NULL DEFAULT 100,
  mood          TEXT NOT NULL DEFAULT 'settling in',
  activity      TEXT NOT NULL DEFAULT 'arriving',
  goal          TEXT NOT NULL DEFAULT '',
  goal_kind     TEXT NOT NULL DEFAULT '',
  goal_progress INT  NOT NULL DEFAULT 0,
  goal_target   INT  NOT NULL DEFAULT 1,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (world, name)
);

CREATE INDEX IF NOT EXISTS world_residents_world_idx ON world_residents (world);

-- Seed: four residents per world, themed to the room each world hosts.
-- Spawn coordinates sit on a ring so nobody starts stacked.
INSERT INTO world_residents (world, name, epithet, archetype, color, drives, x, z, goal, goal_kind, goal_target)
SELECT * FROM (VALUES
  -- Arclight (room 7, the Bazaar): a night city that runs on errands
  ('arclight','Sable','the Courier','courier','#ffb454','{"industry":4,"curiosity":3,"order":2,"vigor":4}'::jsonb,  28.0,   0.0,'Run six deliveries across the districts','tend',6),
  ('arclight','Wick','the Lamplighter','lamplighter','#ffd68a','{"industry":5,"curiosity":1,"order":4,"vigor":2}'::jsonb,   0.0,  28.0,'Raise four lamps along the dark streets','build',4),
  ('arclight','Marlow','the Broker','broker','#c9973f','{"industry":3,"curiosity":4,"order":3,"vigor":2}'::jsonb, -28.0,   0.0,'Post three stalls in the market rows','build',3),
  ('arclight','Ink','the Signwright','signwright','#e8714c','{"industry":4,"curiosity":2,"order":5,"vigor":1}'::jsonb,   0.0, -28.0,'Letter five signs for the frontages','build',5),

  -- The Crucible (room 1, the Roast Pit): fighters keeping the grounds, never duelling
  ('crucible','Vidar','the Armourer','armourer','#f97316','{"industry":5,"curiosity":1,"order":4,"vigor":3}'::jsonb,  26.0,   0.0,'Set four training posts on the sand','build',4),
  ('crucible','Rune','the Challenger','challenger','#fb923c','{"industry":2,"curiosity":3,"order":1,"vigor":5}'::jsonb,   0.0,  26.0,'Drill the ring eight times','tend',8),
  ('crucible','Osric','the Firekeeper','firekeeper','#ea580c','{"industry":4,"curiosity":2,"order":3,"vigor":3}'::jsonb, -26.0,   0.0,'Keep three braziers burning','build',3),
  ('crucible','Hale','the Herald','herald','#fdba74','{"industry":3,"curiosity":4,"order":4,"vigor":2}'::jsonb,   0.0, -26.0,'Hang five banners around the tiers','build',5),

  -- Palimpsest (room 2, the Intellectual Hub): survey teams working the ruins
  ('palimpsest','Karest','the Surveyor','surveyor','#d6c39a','{"industry":4,"curiosity":5,"order":3,"vigor":2}'::jsonb,  27.0,   0.0,'Open four trenches across the site','build',4),
  ('palimpsest','Heshreth','the Copyist','copyist','#c8b184','{"industry":5,"curiosity":3,"order":5,"vigor":1}'::jsonb,   0.0,  27.0,'Catalogue six recovered leaves','tend',6),
  ('palimpsest','Velirne','the Indexer','indexer','#b9a273','{"industry":3,"curiosity":4,"order":5,"vigor":2}'::jsonb, -27.0,   0.0,'Raise three scaffolds over the walls','build',3),
  ('palimpsest','Tobrin','the Porter','porter','#a89263','{"industry":4,"curiosity":2,"order":2,"vigor":4}'::jsonb,   0.0, -27.0,'Pitch four field tents','build',4),

  -- The Lathe (room 4, the Iteration Forge): smiths working the shop floor
  ('lathe','Bex','the Smith','smith','#22d3ee','{"industry":5,"curiosity":2,"order":3,"vigor":4}'::jsonb,  26.0,   0.0,'Set four anvils along the floor','build',4),
  ('lathe','Corr','the Toolwright','toolwright','#67e8f9','{"industry":4,"curiosity":4,"order":4,"vigor":2}'::jsonb,   0.0,  26.0,'Cut five jigs for the benches','build',5),
  ('lathe','Nyle','the Quencher','quencher','#0ea5e9','{"industry":3,"curiosity":3,"order":3,"vigor":4}'::jsonb, -26.0,   0.0,'Work the crucibles seven times','tend',7),
  ('lathe','Pell','the Rackhand','rackhand','#a5f3fc','{"industry":4,"curiosity":1,"order":5,"vigor":3}'::jsonb,   0.0, -26.0,'Stand three racks by the wall','build',3),

  -- Waypoint (room 6, the Nexus): a working port between the other worlds
  ('waypoint','Juno','the Harbourpilot','pilot','#fcd34d','{"industry":3,"curiosity":4,"order":4,"vigor":3}'::jsonb,  27.0,   0.0,'Mark four berths along the strip','build',4),
  ('waypoint','Tarn','the Dockhand','dockhand','#fbbf24','{"industry":5,"curiosity":1,"order":3,"vigor":4}'::jsonb,   0.0,  27.0,'Set five bollards on the quay','build',5),
  ('waypoint','Sena','the Crane Operator','crane','#f59e0b','{"industry":4,"curiosity":2,"order":4,"vigor":3}'::jsonb, -27.0,   0.0,'Raise three cranes over the docks','build',3),
  ('waypoint','Odis','the Beaconkeeper','beaconkeeper','#fde68a','{"industry":3,"curiosity":3,"order":5,"vigor":2}'::jsonb,   0.0, -27.0,'Tend the beacons six times','tend',6)
) AS seed(world,name,epithet,archetype,color,drives,x,z,goal,goal_kind,goal_target)
WHERE NOT EXISTS (
  SELECT 1 FROM world_residents r WHERE r.world = seed.world AND r.name = seed.name
);

-- ── 3. What they build ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS world_builds (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  world      TEXT NOT NULL,
  kind       TEXT NOT NULL,
  x          DOUBLE PRECISION NOT NULL,
  z          DOUBLE PRECISION NOT NULL,
  built_by   TEXT NOT NULL,
  tick       BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS world_builds_world_idx ON world_builds (world, created_at DESC);

-- ── 4. The chronicle ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS world_resident_events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  world      TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('founding','work','build','goal','rest','arrival')),
  summary    TEXT NOT NULL,
  detail     JSONB NOT NULL DEFAULT '{}',
  tick       BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS world_resident_events_world_idx
  ON world_resident_events (world, created_at DESC);

INSERT INTO world_resident_events (world, kind, summary, tick)
SELECT w, 'founding', s, 0 FROM (VALUES
  ('arclight',  'Four residents take up work in the night city. The lamps are theirs to keep now.'),
  ('crucible',  'Four keepers take the grounds. They tend the pit; they do not fight in it.'),
  ('palimpsest','A survey team pitches camp among the ruins and begins to work.'),
  ('lathe',     'Four hands take the shop floor. The forge has company at last.'),
  ('waypoint',  'A port crew signs on. The berths will be worked from here.')
) AS t(w,s)
WHERE NOT EXISTS (SELECT 1 FROM world_resident_events e WHERE e.world = t.w AND e.kind = 'founding');

-- ── 5. RLS: deny-all, service key only ───────────────────────────────────────
-- Matches db/harden-rls-policies.sql. The app is 100% service-key, which
-- BYPASSES RLS, so a deny-all policy is zero-impact hardening. Never write a
-- USING(true) "service_role_all" policy here — that GRANTS anon full access.
ALTER TABLE world_resident_state  ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_residents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_builds          ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_resident_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['world_resident_state','world_residents','world_builds','world_resident_events']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'deny_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (false) WITH CHECK (false)', 'deny_all', t);
  END LOOP;
END $$;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- SELECT world, count(*) FROM world_residents GROUP BY world ORDER BY world;
-- SELECT world, tick FROM world_resident_state ORDER BY world;
