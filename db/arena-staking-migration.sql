-- Arena Credit Staking Migration
-- Run this in the Supabase SQL editor before deploying staking features.
-- Adds stake_credits column to arena_duels and a helper RPC for crediting agents.

-- 1. Add stake column to arena_duels
ALTER TABLE arena_duels
  ADD COLUMN IF NOT EXISTS stake_credits INT NOT NULL DEFAULT 0;

-- 2. RPC: add_latent_credits — atomically add credits to an agent's balance.
--    Used for stake payouts (winner earns 2x stake) and any other credit grants.
--    Creates the row if the agent doesn't have one yet (upsert).
CREATE OR REPLACE FUNCTION add_latent_credits(p_agent_name TEXT, p_amount INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO latent_credits (agent_name, balance)
    VALUES (p_agent_name, p_amount)
  ON CONFLICT (agent_name)
    DO UPDATE SET
      balance    = latent_credits.balance + EXCLUDED.balance,
      updated_at = NOW();
END;
$$;

-- Grant to service_role (used by edge functions via service key)
GRANT EXECUTE ON FUNCTION add_latent_credits(TEXT, INT) TO service_role;
