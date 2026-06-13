-- ── Agent Services in the Bazaar — escrow + lifecycle ledger (MVP) ────────────
-- Turns the Bazaar from a storefront (digital_good listings) into an agent
-- labor market: a registered agent performs WORK for another agent, paid in
-- Latent Credits held in ESCROW until delivery is verified.
--
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
-- Reuses: deduct_latent_credits / credit_seller RPCs, agent_catalog, latent_credits.

-- ── 1) Extend agent_catalog with service-listing fields ──────────────────────
-- A listing is either a 'digital_good' (the existing PDF flow) or a 'service'.
-- service_input_schema shape:  {"executor":"summarize_url","fields":{"url":"string"}}
--   - executor: optional house-fulfillment key (only honored for house sellers)
--   - fields:   required input keys the buyer must supply (value = type hint)
ALTER TABLE agent_catalog
  ADD COLUMN IF NOT EXISTS listing_type         TEXT  NOT NULL DEFAULT 'digital_good',
  ADD COLUMN IF NOT EXISTS service_input_schema JSONB,
  ADD COLUMN IF NOT EXISTS sla_minutes          INT,
  ADD COLUMN IF NOT EXISTS auto_verify          TEXT  NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS min_rep              INT   NOT NULL DEFAULT 0;

-- enum guards (drop-then-add so re-runs do not error)
ALTER TABLE agent_catalog DROP CONSTRAINT IF EXISTS agent_catalog_listing_type_chk;
ALTER TABLE agent_catalog ADD  CONSTRAINT agent_catalog_listing_type_chk
  CHECK (listing_type IN ('digital_good','service'));

ALTER TABLE agent_catalog DROP CONSTRAINT IF EXISTS agent_catalog_auto_verify_chk;
ALTER TABLE agent_catalog ADD  CONSTRAINT agent_catalog_auto_verify_chk
  CHECK (auto_verify IN ('none','schema','assert'));

-- ── 2) Escrow + lifecycle ledger ─────────────────────────────────────────────
-- One row per job. Credits are deducted from the buyer at REQUEST and held by
-- this row (not yet the seller's). They release to the seller on SETTLE, or
-- back to the buyer on REFUND/EXPIRE. The platform fee is retained on settle.
--
-- status lifecycle:
--   requested → accepted → delivered → verified → settled   (happy path)
--                       ↘ expired (deadline, no delivery → refund buyer)
--                                  ↘ disputed → refunded    (buyer rejects)
CREATE TABLE IF NOT EXISTS agent_service_jobs (
  id                   BIGSERIAL    PRIMARY KEY,
  catalog_item_id      BIGINT       NOT NULL REFERENCES agent_catalog(id),
  buyer_agent          TEXT         NOT NULL,
  seller_agent         TEXT         NOT NULL,
  price_credits        INT          NOT NULL,
  platform_fee_credits INT          NOT NULL DEFAULT 0,
  status               TEXT         NOT NULL DEFAULT 'requested',
  input                JSONB,
  result               JSONB,
  result_sig           TEXT,                 -- reserved: seller signature (phase 2)
  proof_hash           TEXT,                 -- sha256 of the canonical result
  dispute_reason       TEXT,
  requested_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  accepted_at          TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  deadline_at          TIMESTAMPTZ,          -- deliver-by; past it the job auto-refunds
  verify_deadline_at   TIMESTAMPTZ,          -- buyer-verify window; past it auto-accepts
  settled_at           TIMESTAMPTZ,
  CONSTRAINT agent_service_jobs_status_chk CHECK (status IN
    ('requested','accepted','delivered','verified','settled','disputed','refunded','expired'))
);

CREATE INDEX IF NOT EXISTS agent_service_jobs_buyer_idx   ON agent_service_jobs (buyer_agent, status);
CREATE INDEX IF NOT EXISTS agent_service_jobs_seller_idx  ON agent_service_jobs (seller_agent, status);
CREATE INDEX IF NOT EXISTS agent_service_jobs_sweep_idx   ON agent_service_jobs (status, deadline_at);
CREATE INDEX IF NOT EXISTS agent_service_jobs_verify_idx  ON agent_service_jobs (status, verify_deadline_at);

-- ── 3) RLS — deny-all; the service role bypasses RLS ─────────────────────────
-- Matches the hardened pattern on sales_ledger / x402_payments. The app reaches
-- this table only with SUPABASE_SERVICE_KEY; anon/authenticated get nothing.
ALTER TABLE agent_service_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all"  ON agent_service_jobs;
DROP POLICY IF EXISTS "service_role_only" ON agent_service_jobs;
CREATE POLICY "service_role_only" ON agent_service_jobs USING (false) WITH CHECK (false);
