# Database — migrations & manual steps

The app talks to Supabase over PostgREST using the **service key only** (see
`lib/supabase.ts`). There is no anon client anywhere. That has one hard
consequence: **every table must be RLS deny-all** (`USING (false) WITH CHECK
(false)`). A `USING (true)` policy does not "allow the service role" (the service
role bypasses RLS entirely) — it grants the public `anon`/`authenticated` roles
full read/write. Treat any permissive policy as a credential leak.

There is no automated migration runner yet. These `.sql` files are applied by
hand in the Supabase SQL editor. Until that changes, this README is the source of
truth for **what must be run and in what order.**

## Required one-time migrations (run these, in order)

Run each in the Supabase SQL editor. All are safe to re-run (idempotent).

| # | File | Purpose | Verify |
|---|------|---------|--------|
| 1 | `harden-rls-policies.sql` | Locks every table to service-role-only. Closes the agent-credential / lead-PII exposure. | Run the audit query (Step 3, below) and confirm **zero** rows with `rls_enabled = false` or a non-`false` policy. |
| 2 | `credit-grant-idempotency.sql` | Creates `credit_grants` (payment-id idempotency for credit packs). Backs `lib/idempotency.ts`. | `SELECT to_regclass('public.credit_grants');` returns the table name, not null. |
| 3 | `meter-daily-rpc.sql` | Atomic daily usage counters (cost guardrails, contact rate limit). | `SELECT proname FROM pg_proc WHERE proname = 'meter_daily';` returns a row. |

> The webhooks and the contact rate limit **fail open** if a migration has not
> been run — the site keeps working, it just loses that specific protection until
> the SQL is applied. So running these is safe and reversible, and *not* running
> them silently drops a safeguard. Run them.

## RLS audit query (Step 3 of harden-rls-policies.sql)

Run this after migration #1 and read the output. Any row where `rls_enabled` is
`false`, or a policy whose `using_expr` / `check_expr` is not `false`, is still
reachable by `anon`:

```sql
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       COALESCE(p.policyname,'(no policy)') AS policy,
       COALESCE(p.qual::text,'-') AS using_expr,
       COALESCE(p.with_check::text,'-') AS check_expr
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity ASC, c.relname, p.policyname;
```

## Convention for new schema changes

- One file per change. Name it `NN-short-description.sql` going forward (existing
  files are unprefixed; leave them).
- Make it **idempotent**: `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE
  FUNCTION`, `DROP POLICY IF EXISTS` before `CREATE POLICY`.
- Every new table gets RLS enabled + a `service_role_only` deny-all policy in the
  same file (copy the block at the bottom of `credit-grant-idempotency.sql`).
- Add the file to the table above if it must be run to keep the app correct.

## Seeds vs. migrations

Files named `seed-*.sql` populate catalog/room data and are environment-specific
— not part of the required-migrations list above. Everything else is schema or
RPC and should be treated as a migration.
