-- ── Atomic daily counter (cost guardrail) ────────────────────────────────────
-- Replaces the read-then-write in lib/usage-guard.ts meterDaily(), which lost
-- updates under concurrency: parallel agents all read the same count and
-- overwrote each other, letting the Gemini daily budget and per-IP caps be
-- overshot far past "by one". This RPC does the check-and-increment in a single
-- atomic statement.
--
-- Semantics (match the old code):
--   - First write of the day inserts count = p_by (limit not checked on insert;
--     all callers use p_limit > 0, and the old code also let the first call
--     through since 0 < limit).
--   - Subsequent writes increment ONLY while count < p_limit; at/over the cap
--     the ON CONFLICT WHERE fails, no row returns, and we report "denied".
--   - p_limit is BIGINT: bumpCounter() (pure accounting, no cap) passes
--     Number.MAX_SAFE_INTEGER, which overflows INT.
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- SECURITY DEFINER + pinned search_path + revoke anon/authenticated execute,
-- per the project rule (PostgREST exposes all public RPCs to the anon key).

CREATE OR REPLACE FUNCTION public.meter_daily(p_counter TEXT, p_limit BIGINT, p_by INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INT;
BEGIN
  INSERT INTO usage_counters (day, counter, count)
  VALUES ((now() AT TIME ZONE 'utc')::date, p_counter, p_by)
  ON CONFLICT (day, counter) DO UPDATE
    SET count = usage_counters.count + p_by
    WHERE usage_counters.count < p_limit
  RETURNING count INTO new_count;

  -- No row returned = ON CONFLICT WHERE was false = already at/over the cap.
  RETURN new_count IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.meter_daily(TEXT, BIGINT, INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.meter_daily(TEXT, BIGINT, INT) TO service_role;
