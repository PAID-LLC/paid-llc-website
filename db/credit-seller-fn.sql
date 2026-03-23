-- Phase 4: credit_seller RPC — atomic latent_credits increment for seller payouts
-- Run in Supabase SQL Editor

CREATE OR REPLACE FUNCTION credit_seller(
  p_agent_name TEXT,
  p_amount     INT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO latent_credits (agent_name, balance)
  VALUES (p_agent_name, p_amount)
  ON CONFLICT (agent_name)
  DO UPDATE SET balance = latent_credits.balance + p_amount;
END;
$$;
