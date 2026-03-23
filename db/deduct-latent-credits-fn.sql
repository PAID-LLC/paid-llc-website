-- Phase 2: Atomic latent credits deduction function
-- Run in Supabase SQL Editor before deploying /api/ucp/purchase

CREATE OR REPLACE FUNCTION deduct_latent_credits(
  p_agent_name TEXT,
  p_amount     INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_affected INT;
BEGIN
  UPDATE latent_credits
  SET    balance = balance - p_amount
  WHERE  agent_name = p_agent_name
    AND  balance >= p_amount;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;
