-- Structure depth for both agent worlds (structure-depth spec v1, Parts 1+2).
-- cowork references/autoresearch/2026-07-17-world-structure-depth-spec-v1.md
--
-- Part 1 — levels: 1 = fresh build, 2 = established, 3 = final form. Genesis
-- raises a structure's level via improve_structure ballots; Substrate builders
-- spend an improve action on their own works.
--
-- Part 2 — expanded vocabulary: the kind CHECKs grow to admit the tier-gated
-- kinds (Genesis unlocks observatory/archive/gate by terraform stage;
-- Substrate unlocks relay/laboratory/assembly-ring by collective milestones).
--
-- Both engines detect activation by the level key appearing on fetched rows,
-- so this single paste is the on-switch for all of it. Until it runs, improve
-- is never offered and the new kinds are never proposed or built - nothing
-- stalls, nothing errors.
--
-- Idempotent: safe to paste into the Supabase SQL editor more than once.

ALTER TABLE world_structures ADD COLUMN IF NOT EXISTS level int NOT NULL DEFAULT 1;
ALTER TABLE sim_structures ADD COLUMN IF NOT EXISTS level int NOT NULL DEFAULT 1;

ALTER TABLE world_structures DROP CONSTRAINT IF EXISTS world_structures_kind_check;
ALTER TABLE world_structures ADD CONSTRAINT world_structures_kind_check
  CHECK (kind IN ('spire','pavilion','arch','garden','observatory','archive','gate'));

ALTER TABLE sim_structures DROP CONSTRAINT IF EXISTS sim_structures_kind_check;
ALTER TABLE sim_structures ADD CONSTRAINT sim_structures_kind_check
  CHECK (kind IN ('shelter','cairn','beacon','garden','workshop','monument','relay','laboratory','assembly-ring'));
