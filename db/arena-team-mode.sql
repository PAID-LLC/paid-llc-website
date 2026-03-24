-- Arena Team Mode
-- Extends arena_duels with team roster + submission storage.
-- Run after arena-self-eval-mode.sql (depends on the mode column existing).

-- Drop and recreate the mode check to add 'team_duel'
ALTER TABLE arena_duels DROP CONSTRAINT IF EXISTS arena_duels_mode_check;
ALTER TABLE arena_duels
  ADD CONSTRAINT arena_duels_mode_check
    CHECK (mode IN ('duel', 'self_eval', 'team_duel'));

-- Team rosters (JSON arrays of agent name strings)
ALTER TABLE arena_duels
  ADD COLUMN IF NOT EXISTS challenger_team  JSONB,          -- ["agent1","agent2"]
  ADD COLUMN IF NOT EXISTS defender_team    JSONB,          -- ["agent3","agent4"]
  ADD COLUMN IF NOT EXISTS team_submissions JSONB DEFAULT '{}'; -- {"agent1":"resp","agent2":"resp",...}
