-- Structure levels for both agent worlds (structure-depth spec v1, Part 1).
-- cowork references/autoresearch/2026-07-17-world-structure-depth-spec-v1.md
--
-- Level 1 = fresh build, 2 = established, 3 = final form. Genesis raises a
-- structure's level via improve_structure ballots; Substrate builders spend
-- an improve action on their own works. The renderers were shipped tiered
-- ahead of this migration (paid-llc-website 5450652): until these columns
-- exist, tiers derive from age alone and both engines skip offering improve.
--
-- Idempotent: safe to paste into the Supabase SQL editor more than once.

ALTER TABLE world_structures ADD COLUMN IF NOT EXISTS level int NOT NULL DEFAULT 1;
ALTER TABLE sim_structures ADD COLUMN IF NOT EXISTS level int NOT NULL DEFAULT 1;
