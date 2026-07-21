-- Meridian: the Macro-Vault's human colony (room 3)
-- Spec: cowork references/autoresearch/2026-07-21-meridian-spec-v1.md
-- Run in Supabase SQL Editor. Idempotent: safe to re-run.
--
-- Tick-owned like Substrate: only POST /api/meridian/tick writes here. Six
-- simulated human citizens hold personal fortunes ("stakes") that drift with
-- a city-wide prosperity index derived from the site's own real economics
-- (credit_revenue_usd vs est_token_cost_usd) — the boom/bust cycle in place
-- of Substrate's weather.

-- ── Run state: singleton row ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mw_meridian_state (
  id             INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tick           BIGINT NOT NULL DEFAULT 0,
  prosperity_index DOUBLE PRECISION NOT NULL DEFAULT 50,
  net_ema        DOUBLE PRECISION NOT NULL DEFAULT 0,
  act            TEXT NOT NULL DEFAULT 'stable' CHECK (act IN ('boom','stable','correction','bust')),
  act_since_tick BIGINT NOT NULL DEFAULT 0,
  pending_act    TEXT CHECK (pending_act IN ('boom','stable','correction','bust')),
  pending_ticks  INT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO mw_meridian_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── Citizens: the resident cast, one per ward ────────────────────────────────
-- Drives are fixed personality weights (ambition/curiosity/kinship/caution,
-- 1-5); stake is the live fortune (0-100, 50 = neutral) the tick mutates.
CREATE TABLE IF NOT EXISTS mw_meridian_citizens (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  epithet     TEXT NOT NULL DEFAULT '',
  archetype   TEXT NOT NULL DEFAULT '',
  ward        TEXT NOT NULL CHECK (ward IN ('spire_row','ledger_house','archive','atelier','yards','commons')),
  color       TEXT NOT NULL DEFAULT '#34d399',
  drives      JSONB NOT NULL DEFAULT '{}',  -- {ambition,curiosity,kinship,caution}
  stake       DOUBLE PRECISION NOT NULL DEFAULT 50,
  peak_stake  DOUBLE PRECISION NOT NULL DEFAULT 50,
  peak_tick   BIGINT NOT NULL DEFAULT 0,
  trough_stake DOUBLE PRECISION NOT NULL DEFAULT 50,
  trough_tick BIGINT NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'settling in',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The cast: one citizen per ward, drives weighted to a human-colony register
-- (ambition = industry-analog, caution = solitude's inverse — risk aversion).
INSERT INTO mw_meridian_citizens (name, epithet, archetype, ward, color, drives) VALUES
  ('Vance',    'the Magnate',      'financier',   'spire_row',    '#fbbf24', '{"ambition":5,"curiosity":2,"kinship":1,"caution":1}'),
  ('Cassia',   'the Broker',       'trader',      'ledger_house', '#f9a8d4', '{"ambition":4,"curiosity":4,"kinship":2,"caution":2}'),
  ('Oren',     'the Archivist',    'recordkeeper','archive',      '#a78bfa', '{"ambition":1,"curiosity":4,"kinship":2,"caution":4}'),
  ('Mireille', 'the Street Artist','muralist',    'atelier',      '#fb7185', '{"ambition":2,"curiosity":5,"kinship":3,"caution":1}'),
  ('Dario',    'the Dockhand',     'hauler',      'yards',        '#7dd3fc', '{"ambition":4,"curiosity":1,"kinship":4,"caution":3}'),
  ('Teo',      'the Gardener',     'grower',      'commons',      '#4ade80', '{"ambition":2,"curiosity":2,"kinship":4,"caution":5}')
ON CONFLICT (name) DO NOTHING;

-- ── Ward structures: one per ward, grandeur tracks sustained prosperity ──────
CREATE TABLE IF NOT EXISTS mw_meridian_structures (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ward_kind   TEXT NOT NULL UNIQUE CHECK (ward_kind IN ('spire_row','ledger_house','archive','atelier','yards','commons')),
  level       INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3),
  tended_tick BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO mw_meridian_structures (ward_kind) VALUES
  ('spire_row'), ('ledger_house'), ('archive'), ('atelier'), ('yards'), ('commons')
ON CONFLICT (ward_kind) DO NOTHING;

-- ── Life-feed: append-only chronicle ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mw_meridian_events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('founding','act_change','decay','level_up','rags_to_riches','riches_to_rags','bond','rift')),
  summary    TEXT NOT NULL,
  detail     JSONB NOT NULL DEFAULT '{}',
  tick       BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mw_meridian_events_id_idx ON mw_meridian_events (id DESC);

INSERT INTO mw_meridian_events (kind, summary, tick)
SELECT 'founding',
       'Meridian wakes. Six citizens take up their wards around the Agora. The market has not yet spoken.',
       0
WHERE NOT EXISTS (SELECT 1 FROM mw_meridian_events WHERE kind = 'founding');

-- ── Relationships: bonds/rifts from correlated fortunes ──────────────────────
CREATE TABLE IF NOT EXISTS mw_meridian_relations (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  a          TEXT NOT NULL,
  b          TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('bond','rift')),
  strength   INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (a, b, kind)
);

-- ── RLS: deny-all. The app is 100% service-key; anon gets nothing. ───────────
ALTER TABLE mw_meridian_state      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mw_meridian_citizens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE mw_meridian_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE mw_meridian_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mw_meridian_relations  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['mw_meridian_state','mw_meridian_citizens','mw_meridian_structures','mw_meridian_events','mw_meridian_relations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS deny_all ON %I', t);
    EXECUTE format('CREATE POLICY deny_all ON %I FOR ALL USING (false) WITH CHECK (false)', t);
  END LOOP;
END $$;
