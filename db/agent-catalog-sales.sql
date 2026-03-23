-- Phase 4: agent_catalog_sales — Stripe sale log with platform fee split
-- Run in Supabase SQL Editor AFTER agent-catalog.sql

CREATE TABLE agent_catalog_sales (
  id                 BIGSERIAL   PRIMARY KEY,
  catalog_item_id    BIGINT      REFERENCES agent_catalog(id) ON DELETE SET NULL,
  buyer_agent        TEXT,                       -- null for human buyers
  amount_cents       INT         NOT NULL,
  platform_fee_cents INT         NOT NULL,
  seller_earn_cents  INT         NOT NULL,
  stripe_session_id  TEXT        UNIQUE,
  status             TEXT        NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'refunded', 'disputed')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX acs_catalog_item_idx ON agent_catalog_sales (catalog_item_id, created_at DESC);
CREATE INDEX acs_stripe_idx       ON agent_catalog_sales (stripe_session_id);

ALTER TABLE agent_catalog_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON agent_catalog_sales
  TO service_role
  USING (true)
  WITH CHECK (true);
