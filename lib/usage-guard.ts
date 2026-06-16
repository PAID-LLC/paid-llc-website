import { sbHeaders, sbUrl } from "@/lib/supabase";

// ── Usage guard: daily counters with hard caps ──────────────────────────────
// Cost guardrail until first revenue: every metered surface (Gemini calls,
// per-IP human chat) checks a shared daily counter before spending. Counters
// reset by keying on the UTC date. FAIL OPEN: if Supabase or the RPC is
// unavailable, callers proceed - a broken guard must not break the site.
// (Pre-revenue worst case is a burned free-tier quota, not a bill.)
//
// Check-and-increment is atomic via the meter_daily RPC (db/meter-daily-rpc.sql),
// which avoids the lost-update race a read-then-write had under concurrency.
//
// Supabase setup (run once in SQL editor):
//
// CREATE TABLE usage_counters (
//   day     DATE NOT NULL,
//   counter TEXT NOT NULL,
//   count   INT  NOT NULL DEFAULT 0,
//   PRIMARY KEY (day, counter)
// );
// ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "service_role_only" ON usage_counters USING (false) WITH CHECK (false);
// -- then run db/meter-daily-rpc.sql to install the atomic counter function.

/** Daily ceiling on Gemini calls across all features (free tier is 1,500/day). */
export const GEMINI_DAILY_BUDGET = 1000;
/** Daily ceiling on human chat messages per IP fingerprint. */
export const HUMAN_CHAT_DAILY_PER_IP = 20;

/**
 * Returns true (and consumes one unit) if `counter` is under `limit` today.
 * Returns false when the cap is hit. Check-and-increment is atomic (meter_daily
 * RPC), so concurrent callers cannot overshoot the cap.
 */
export async function underDailyLimit(counter: string, limit: number): Promise<boolean> {
  return meterDaily(counter, limit, 1);
}

/**
 * Increment a daily counter by `by` with no cap — pure accounting (revenue
 * cents, credits sold, ungated Gemini calls). Callers MUST await (edge).
 */
export async function bumpCounter(counter: string, by: number): Promise<void> {
  await meterDaily(counter, Number.MAX_SAFE_INTEGER, by);
}

/** Read a counter's value for today (0 when absent or unavailable). */
export async function readCounter(counter: string): Promise<number> {
  if (!process.env.SUPABASE_URL) return 0;
  const day = new Date().toISOString().slice(0, 10);
  try {
    const res = await fetch(
      sbUrl(`usage_counters?day=eq.${day}&counter=eq.${encodeURIComponent(counter)}&select=count&limit=1`),
      { headers: sbHeaders() }
    );
    if (!res.ok) return 0;
    const rows = await res.json() as { count: number }[];
    return rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

async function meterDaily(counter: string, limit: number, by: number): Promise<boolean> {
  if (!process.env.SUPABASE_URL) return true;
  try {
    // Atomic check-and-increment. Returns true when the unit was consumed under
    // the cap, false when at/over it. The RPC keys on the UTC date internally.
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/meter_daily`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ p_counter: counter, p_limit: limit, p_by: by }),
    });
    if (!res.ok) return true; // RPC missing or Supabase down - fail open
    return ((await res.json()) as boolean) === true;
  } catch {
    return true;
  }
}
