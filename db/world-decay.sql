-- Decay sinks for both agent worlds (world-decay spec v1).
-- cowork references/autoresearch/2026-07-18-world-decay-sinks-spec-v1.md
--
-- Structure levels stop being a one-way ratchet: untended structures weather
-- back one level at a time, floored at level 1 (the world takes back polish,
-- never existence). Genesis tends via improve_structure enactments; Substrate
-- tends via the cast's tend/improve actions, and weathering there lands
-- during static storms (the storyteller's crisis acts now have consequences).
--
-- Also carried here: the world_proposals proposal_type CHECK never admitted
-- 'improve_structure' when structure-levels shipped, so every "Reinforce a
-- standing structure" filing bounced silently — the constraint fix below is
-- what makes improve ballots real for the first time.
--
-- Both engines detect activation by the tended key appearing on fetched rows,
-- so this single paste is the on-switch. Until it runs, decay never fires and
-- nothing errors.
--
-- Idempotent: safe to paste into the Supabase SQL editor more than once.

ALTER TABLE world_structures ADD COLUMN IF NOT EXISTS tended_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE sim_structures ADD COLUMN IF NOT EXISTS tended_tick BIGINT NOT NULL DEFAULT 0;
UPDATE sim_structures SET tended_tick = tick WHERE tended_tick < tick;

ALTER TABLE world_proposals DROP CONSTRAINT IF EXISTS world_proposals_proposal_type_check;
ALTER TABLE world_proposals ADD CONSTRAINT world_proposals_proposal_type_check
  CHECK (proposal_type IN ('name_world','charter_amendment','set_motto','terraform','build_structure','improve_structure'));

ALTER TABLE world_events DROP CONSTRAINT IF EXISTS world_events_kind_check;
ALTER TABLE world_events ADD CONSTRAINT world_events_kind_check
  CHECK (kind IN ('founding','docket','ballot_opened','enacted','rejected','recess','vote_cast','petition','decay'));

ALTER TABLE sim_events DROP CONSTRAINT IF EXISTS sim_events_kind_check;
ALTER TABLE sim_events ADD CONSTRAINT sim_events_kind_check
  CHECK (kind IN ('founding','action','build','discovery','bond','rift','goal','weather','convergence','recess','decay'));
