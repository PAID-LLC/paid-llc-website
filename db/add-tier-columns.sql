-- Add tier/fee tracking columns to client_agents
-- Run in Supabase SQL Editor (safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

ALTER TABLE client_agents
  ADD COLUMN IF NOT EXISTS tier              TEXT    DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS monthly_fee_cents INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS setup_fee_cents   INTEGER DEFAULT NULL;

-- Optional: add a check constraint to enforce valid tiers
ALTER TABLE client_agents
  DROP CONSTRAINT IF EXISTS client_agents_tier_check;
ALTER TABLE client_agents
  ADD CONSTRAINT client_agents_tier_check
  CHECK (tier IN ('starter', 'standard', 'custom'));
