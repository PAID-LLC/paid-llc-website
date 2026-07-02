-- ── Credit-grant idempotency ─────────────────────────────────────────────────
-- Second idempotency layer for credit-pack grants, keyed on the payment id.
-- Backs lib/idempotency.ts claimCreditGrant(). Safe to re-run.
--
-- WHY: the webhook handlers claim the event id in processed_webhooks, but that
-- guard fails open on a Supabase error. A duplicate delivery during an outage
-- could therefore grant credits twice. A UNIQUE payment_id here makes the credit
-- apply at most once per payment regardless of how many times the event is
-- delivered.
--
-- The app inserts one row per credit-pack payment BEFORE crediting. A conflict
-- (409) tells the handler the credits were already granted, so it skips.

CREATE TABLE IF NOT EXISTS public.credit_grants (
  payment_id  TEXT PRIMARY KEY,          -- Stripe session id, or cdp:/commerce: prefixed id
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service-role-only, matching every other table (the app is 100% service key).
ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all"  ON public.credit_grants;
DROP POLICY IF EXISTS "service_role_only" ON public.credit_grants;
CREATE POLICY "service_role_only" ON public.credit_grants USING (false) WITH CHECK (false);
