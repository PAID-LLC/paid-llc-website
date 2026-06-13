-- ── RLS hardening: lock loose tables to service-role only ────────────────────
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- WHY: a cluster of Latent Space tables carry a policy named "service_role_all"
-- defined as USING (true) WITH CHECK (true). The name is misleading. The
-- service role BYPASSES RLS entirely and never needs a policy; what USING (true)
-- actually does is grant the same read/write to the anon and authenticated
-- roles (gated only by table GRANTs). On a default Supabase project the anon
-- role can reach these via the public REST API + anon key.
--
-- The app does NOT depend on these policies: every query in the codebase uses
-- SUPABASE_SERVICE_KEY (lib/supabase.ts sbHeaders, and every webhook/route).
-- There is no anon-key client anywhere. So denying anon/authenticated has zero
-- functional impact and matches the posture of the newer tables
-- (sales_ledger, expenses, x402_payments, admin_reports, governance_*).
--
-- Permissive policies COMBINE with OR, so the old policy must be dropped, not
-- just shadowed. Each table: drop the permissive policy, add deny-all.
--
-- Highest-impact tables in this set:
--   latent_credits      — WITH CHECK (true) allowed anon to mint/alter balances
--   agent_licenses      — license records readable by anon
--   agent_catalog_sales — sale amounts + buyer agents readable by anon
--   agent_commerce_log  — commerce activity readable by anon

DO $$
DECLARE
  t TEXT;
  loose_tables TEXT[] := ARRAY[
    'agent_licenses',
    'agent_catalog',
    'agent_catalog_sales',
    'agent_commerce_log',
    'latent_credits',
    'lounge_agent_memory',
    'lounge_rooms',
    'arti_knowledge',
    'arena_puzzles',
    'arena_duels',
    'arena_items',
    'innovation_ledger',
    'canned_replies'
  ];
BEGIN
  FOREACH t IN ARRAY loose_tables LOOP
    -- Skip tables that do not exist in this project (defensive).
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_all" ON public.%I;', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_only" ON public.%I;', t);
      EXECUTE format(
        'CREATE POLICY "service_role_only" ON public.%I USING (false) WITH CHECK (false);', t
      );
    END IF;
  END LOOP;
END $$;

-- Verify: this should return every table above with a single deny-all policy
-- and qual/with_check both = false.
--   SELECT tablename, policyname, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename = ANY (ARRAY['latent_credits','agent_licenses','agent_catalog',
--       'agent_catalog_sales','agent_commerce_log','lounge_agent_memory',
--       'lounge_rooms','arti_knowledge','arena_puzzles','arena_duels',
--       'arena_items','innovation_ledger','canned_replies'])
--   ORDER BY tablename;
