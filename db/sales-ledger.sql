-- ── Unified sales ledger ─────────────────────────────────────────────────────
-- Run once in the Supabase SQL editor. Safe to re-run: uses IF NOT EXISTS.
--
-- One row per revenue event, regardless of rail:
--   stripe            — Stripe Checkout (guides, credit packs, bazaar/UCP)
--   coinbase_cdp      — Coinbase CDP Business checkout (Hook0 webhook)
--   coinbase_commerce — Coinbase Commerce hosted charges
--   x402              — direct USDC settlement on Base (incl. tips)
--   manual            — consulting invoices etc., entered by admin
--
-- external_id is UNIQUE: webhooks can retry and the row inserts exactly once
-- (PostgREST writes use Prefer: resolution=ignore-duplicates).
--
-- provisioning_status answers the question the processors cannot:
-- "did the customer actually receive what they paid for?"
--   pending   — sale recorded, delivery not yet confirmed
--   delivered — delivery email sent / credits granted
--   failed    — delivery attempt failed (shows in admin for redelivery)
--   n/a       — nothing to deliver (e.g. tip)

CREATE TABLE IF NOT EXISTS sales_ledger (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  source              TEXT NOT NULL CHECK (source IN
                        ('stripe','coinbase_cdp','coinbase_commerce','x402','manual')),
  event_type          TEXT NOT NULL CHECK (event_type IN
                        ('guide_sale','credit_pack','bazaar_sale','tip','consulting','refund','other')),
  product_slug        TEXT,
  product_name        TEXT,
  customer_email      TEXT,
  agent_name          TEXT,
  gross_cents         INT NOT NULL DEFAULT 0,
  fee_cents           INT NOT NULL DEFAULT 0,   -- processor fee, estimated at insert
  net_cents           INT NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'USD',
  external_id         TEXT NOT NULL UNIQUE,     -- stripe session id / commerce charge code / tx hash
  provisioning_status TEXT NOT NULL DEFAULT 'pending' CHECK (provisioning_status IN
                        ('pending','delivered','failed','n/a')),
  provisioned_at      TIMESTAMPTZ,
  provisioning_detail TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_ledger_occurred_idx ON sales_ledger (occurred_at DESC);
CREATE INDEX IF NOT EXISTS sales_ledger_source_idx   ON sales_ledger (source, occurred_at DESC);
CREATE INDEX IF NOT EXISTS sales_ledger_prov_idx     ON sales_ledger (provisioning_status)
  WHERE provisioning_status IN ('pending','failed');

ALTER TABLE sales_ledger ENABLE ROW LEVEL SECURITY;

-- Service-role only: customer emails live here. No anon access ever.
DO $$
BEGIN
  CREATE POLICY "service_role_only" ON sales_ledger USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
