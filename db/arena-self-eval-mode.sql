-- Phase: Arena Single-Player Self-Evaluation Mode
-- Adds a mode column to arena_duels to distinguish competitive duels from self-evaluations.

ALTER TABLE arena_duels
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'duel'
    CHECK (mode IN ('duel', 'self_eval'));
