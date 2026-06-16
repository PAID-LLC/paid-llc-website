-- ── Supabase database-linter remediation (2026-06-16) ───────────────────────
-- Run once in the Supabase SQL editor. Idempotent. Safe to re-run.
--
-- Closes three linter WARN classes:
--   1. function_search_path_mutable                — 8 SECURITY DEFINER functions
--   2. anon/authenticated_security_definer_function_executable — credit + state RPCs
--   3. rls_policy_always_true                       — agent_feedback, leads,
--                                                     latent_context, usage_counters
--
-- WHY THIS IS SAFE: the app uses SUPABASE_SERVICE_KEY for 100% of DB access
-- (lib/supabase.ts; there is no browser-side anon client anywhere — even the
-- blog view counter calls a server route). The service role BYPASSES RLS and is
-- granted EXECUTE explicitly below. So denying anon/authenticated is zero-impact
-- on the app while removing real attack surface.
--
-- THE SHARP ONE (#2): add_latent_credits / credit_seller / deduct_latent_credits
-- are SECURITY DEFINER and were EXECUTE-able by the public `anon` role via
-- /rest/v1/rpc/*. The anon key is public by design, so anyone who knows the
-- project ref could mint or move Latent Credits. This file revokes that.

-- ── Part 1: SECURITY DEFINER functions — pin search_path + lock EXECUTE ───────
-- Signature-agnostic so it catches every overload and the functions whose
-- CREATE statements live outside the repo (transfer_latent_credits,
-- increment_blog_view). pg_catalog is always searched implicitly, so pinning to
-- `public` keeps unqualified references to app tables working.
DO $$
DECLARE
  fn RECORD;
  fn_names TEXT[] := ARRAY[
    'add_latent_credits', 'credit_seller', 'deduct_latent_credits',
    'transfer_latent_credits', 'redeem_agent_license', 'try_claim_duel_slot',
    'arena_team_add_response', 'increment_blog_view'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(fn_names)
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public;', fn.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated;', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', fn.sig);
  END LOOP;
END $$;

-- ── Part 2: replace always-true write policies with deny-all ──────────────────
-- The generic harden-rls-policies.sql sweep only catches policies literally
-- named "service_role_all". These four carry that footgun OR a differently-named
-- anon INSERT policy, so they need explicit handling. service_role bypasses RLS,
-- so deny-all does not touch the app's own writes.
DROP POLICY IF EXISTS "service_role_all"           ON public.latent_context;
DROP POLICY IF EXISTS "service_role_all"           ON public.usage_counters;
DROP POLICY IF EXISTS "agents can insert feedback" ON public.agent_feedback;
DROP POLICY IF EXISTS "Allow public inserts"       ON public.leads;

DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY['latent_context', 'usage_counters', 'agent_feedback', 'leads'];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_only" ON public.%I;', t);
      EXECUTE format('CREATE POLICY "service_role_only" ON public.%I USING (false) WITH CHECK (false);', t);
    END IF;
  END LOOP;
END $$;

-- ── Part 3: AUDIT — run and read the output ──────────────────────────────────
-- (a) Functions: proconfig should show search_path=public; proacl must NOT list
--     anon/authenticated (=arwdDxt is the broad default to look for and confirm
--     is gone for those roles).
SELECT p.proname AS function, p.prosecdef AS security_definer,
       p.proconfig AS settings, p.proacl AS acl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = ANY(ARRAY[
  'add_latent_credits', 'credit_seller', 'deduct_latent_credits',
  'transfer_latent_credits', 'redeem_agent_license', 'try_claim_duel_slot',
  'arena_team_add_response', 'increment_blog_view'])
ORDER BY p.proname;

-- (b) The four tables: rls_enabled = true and only the deny-all policy remains.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       COALESCE(pol.policyname, '(none)') AS policy,
       COALESCE(pol.qual::text, '-')       AS using_expr,
       COALESCE(pol.with_check::text, '-') AS check_expr
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies pol ON pol.schemaname = n.nspname AND pol.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relname IN ('latent_context', 'usage_counters', 'agent_feedback', 'leads')
ORDER BY c.relname, pol.policyname;
