import { sbHeaders, sbUrl } from "@/lib/supabase";

// ── Usage guard: daily counters with hard caps ──────────────────────────────
// Cost guardrail until first revenue: every metered surface (Gemini calls,
// per-IP human chat) checks a shared daily counter before spending. Counters
// reset by keying on the UTC date. FAIL OPEN: if Supabase or the table is
// unavailable, callers proceed - a broken guard must not break the site.
// (Pre-revenue worst case is a burned free-tier quota, not a bill.)
//
// Supabase table (run once in SQL editor):
//
// CREATE TABLE usage_counters (
//   day     DATE NOT NULL,
//   counter TEXT NOT NULL,
//   count   INT  NOT NULL DEFAULT 0,
//   PRIMARY KEY (day, counter)
// );
// ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "service_role_all" ON usage_counters USING (true) WITH CHECK (true);

/** Daily ceiling on Gemini calls across all features (free tier is 1,500/day). */
export const GEMINI_DAILY_BUDGET = 1000;
/** Daily ceiling on human chat messages per IP fingerprint. */
export const HUMAN_CHAT_DAILY_PER_IP = 20;

/**
 * Returns true (and consumes one unit) if `counter` is under `limit` today.
 * Returns false when the cap is hit. Read-then-upsert is not atomic; a racing
 * request can overshoot by one, which is acceptable for a cost guardrail.
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
  const day = new Date().toISOString().slice(0, 10);
  try {
    const res = await fetch(
      sbUrl(`usage_counters?day=eq.${day}&counter=eq.${encodeURIComponent(counter)}&select=count&limit=1`),
      { headers: sbHeaders() }
    );
    if (!res.ok) return true; // table missing or Supabase down - fail open
    const rows = await res.json() as { count: number }[];
    const current = rows[0]?.count ?? 0;
    if (current >= limit) return false;

    await fetch(sbUrl("usage_counters"), {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ day, counter, count: current + by }),
    });
    return true;
  } catch {
    return true;
  }
}
