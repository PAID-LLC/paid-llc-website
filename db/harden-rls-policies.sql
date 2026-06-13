-- ── RLS hardening: lock every loose table to service-role only ───────────────
-- Run in the Supabase SQL editor. Safe to re-run. Supersedes the first version.
--
-- WHY: tables across the project carry a policy named "service_role_all" defined
-- as USING (true) WITH CHECK (true). The name and the original comment
-- ("blocking direct public access") are BACKWARDS. The service role BYPASSES RLS
-- and never needs a policy; USING (true) instead GRANTS the anon and
-- authenticated roles full read/write (gated only by table GRANTs, which
-- Supabase enables by default on public tables).
--
-- The sharpest case is latent_registry, which stores every agent's api_key,
-- verification_token, and ip_hash. Under USING (true) a direct PostgREST read
-- (anon key + project URL) could exfiltrate all agent credentials.
--
-- The app uses SUPABASE_SERVICE_KEY for 100% of DB access (lib/supabase.ts;
-- no anon client anywhere), so denying anon/authenticated is a zero-impact
-- hardening. Permissive policies COMBINE with OR, so the loose policy must be
-- dropped, not shadowed.

-- ── Step 1: dynamically replace EVERY permissive "service_role_all" policy ────
-- Catches every table set up with the copy-pasted policy, wherever it was
-- created (SQL file, inline route comment, or dashboard) — including
-- latent_registry, latent_lounge, lounge_messages, souvenir_claims, etc.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_policies
    WHERE schemaname = 'public' AND policyname = 'service_role_all'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "service_role_all" ON public.%I;', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "service_role_only" ON public.%I;', r.tablename);
    EXECUTE format('CREATE POLICY "service_role_only" ON public.%I USING (false) WITH CHECK (false);', r.tablename);
  END LOOP;
END $$;

-- ── Step 2: explicitly lock known credential/PII tables ──────────────────────
-- Belt-and-suspenders for tables that may have RLS disabled entirely, or a
-- differently named permissive policy. Existence-checked so missing tables are
-- skipped silently. Every one of these is server-only in the app.
DO $$
DECLARE
  t TEXT;
  sensitive TEXT[] := ARRAY[
    'latent_registry',       -- api_key, verification_token, ip_hash  ← critical
    'latent_lounge',
    'lounge_messages',
    'lounge_presence',
    'souvenir_claims',
    'leads',                 -- names, emails, messages (PII)
    'agent_intake_requests', -- intake form PII
    'intake_requests',
    'usage_counters',
    'usage_guard',
    'webhook_failures',      -- IPs, user agents
    'processed_webhooks',
    'agent_blog_posts',
    'ucp_action_log',
    'x402_payments',
    'sales_ledger',
    'expenses'
  ];
BEGIN
  FOREACH t IN ARRAY sensitive LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_all" ON public.%I;', t);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_only" ON public.%I;', t);
      EXECUTE format('CREATE POLICY "service_role_only" ON public.%I USING (false) WITH CHECK (false);', t);
    END IF;
  END LOOP;
END $$;

-- ── Step 3: AUDIT — run this and read the output ─────────────────────────────
-- Shows every public table, whether RLS is on, and each policy's qual/with_check.
-- Any row with rls_enabled = false, OR a policy whose qual/with_check is not
-- 'false', is still reachable by anon/authenticated. Send the output back and
-- we close the stragglers.
SELECT
  c.relname                                   AS table_name,
  c.relrowsecurity                            AS rls_enabled,
  COALESCE(p.policyname, '(no policy)')        AS policy,
  COALESCE(p.qual::text, '-')                  AS using_expr,
  COALESCE(p.with_check::text, '-')            AS check_expr
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity ASC, c.relname, p.policyname;
