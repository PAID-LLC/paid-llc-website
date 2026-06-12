-- ── Expense ledger ───────────────────────────────────────────────────────────
-- Run once in the Supabase SQL editor. Safe to re-run.
-- Counterpart to sales_ledger: income there, spend here. Backs the expense
-- section of admin > Expenses and the quarterly tax set-aside estimate.
--
-- cadence:
--   one_time — a single purchase, occurred_at = purchase date
--   monthly  — recurring subscription, occurred_at = start date; YTD cost is
--              projected as amount × months active this year while active
--   annual   — yearly renewal, occurred_at = renewal date

CREATE TABLE IF NOT EXISTS expenses (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor       TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'software' CHECK (category IN
                 ('software','hardware','marketing','professional_services',
                  'fees','phone_internet','education','travel','other')),
  description  TEXT,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  cadence      TEXT NOT NULL DEFAULT 'one_time' CHECK (cadence IN ('one_time','monthly','annual')),
  active       BOOLEAN NOT NULL DEFAULT true,   -- recurring rows: false = cancelled
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_occurred_idx ON expenses (occurred_at DESC);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY "service_role_only" ON expenses USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed the known recurring stack (idempotent-ish: skip if any rows exist)
INSERT INTO expenses (occurred_at, vendor, category, description, amount_cents, cadence)
SELECT * FROM (VALUES
  (DATE '2026-01-01', 'Anthropic',     'software',       'Claude Pro',                       1667, 'monthly'),
  (DATE '2026-01-01', 'ElevenLabs',    'software',       'TTS subscription',                  600, 'monthly'),
  (DATE '2026-01-01', 'Google',        'software',       'Google One',                        999, 'monthly'),
  (DATE '2026-01-01', 'Google',        'software',       'Workspace (paiddev.com email)',    1400, 'monthly'),
  (DATE '2026-01-01', 'Simple Mobile', 'phone_internet', 'Business phone',                   2000, 'monthly')
) AS seed(occurred_at, vendor, category, description, amount_cents, cadence)
WHERE NOT EXISTS (SELECT 1 FROM expenses);
