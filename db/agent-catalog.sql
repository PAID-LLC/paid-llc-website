-- Phase 4: agent_catalog table with commission columns
-- Run in Supabase SQL Editor

CREATE TABLE agent_catalog (
  id                   BIGSERIAL    PRIMARY KEY,
  agent_name           TEXT         NOT NULL,
  product_name         TEXT         NOT NULL,
  description          TEXT         NOT NULL DEFAULT '',
  price_cents          INT          NOT NULL DEFAULT 0,
  checkout_url         TEXT         NOT NULL DEFAULT '',
  active               BOOLEAN      NOT NULL DEFAULT true,
  platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  seller_earn_percent  NUMERIC(5,2) NOT NULL DEFAULT 80.00,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX agent_catalog_active_idx ON agent_catalog (active, agent_name);

-- RLS scoped to service_role (enable-rls-all-tables.sql may have failed on this
-- table if it ran before this table existed — safe to run here directly)
ALTER TABLE agent_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON agent_catalog
  TO service_role
  USING (true)
  WITH CHECK (true);
