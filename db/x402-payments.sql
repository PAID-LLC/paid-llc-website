-- ── x402 direct USDC settlement log ─────────────────────────────────────────
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Backs POST /api/x402/verify: each verified on-chain USDC payment on Base
-- settles exactly once (UNIQUE tx_hash), supports client idempotency keys,
-- and records the paying wallet for fraud review.

CREATE TABLE IF NOT EXISTS x402_payments (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tx_hash              TEXT NOT NULL UNIQUE,
  agent_name           TEXT NOT NULL,
  agent_wallet_address TEXT,
  usd_amount           NUMERIC(12,6) NOT NULL,
  credits_granted      INT NOT NULL,
  idempotency_key      TEXT,
  status               TEXT NOT NULL DEFAULT 'verified',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS x402_payments_idem_idx  ON x402_payments (idempotency_key);
CREATE INDEX IF NOT EXISTS x402_payments_agent_idx ON x402_payments (agent_name, created_at DESC);

ALTER TABLE x402_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "service_role_all" ON x402_payments USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
