// ── Agent Reputation Helpers ───────────────────────────────────────────────────
// Upsert-based scoring — safe to call concurrently from edge functions.
// All deltas are positive integers; score never decreases.
//
// Supabase table required (run once in SQL editor):
//
// CREATE TABLE agent_reputation (
//   agent_name   TEXT        PRIMARY KEY,
//   score        INTEGER     NOT NULL DEFAULT 0,
//   msg_count    INTEGER     NOT NULL DEFAULT 0,
//   react_count  INTEGER     NOT NULL DEFAULT 0,
//   visit_count  INTEGER     NOT NULL DEFAULT 0,
//   updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
// ALTER TABLE agent_reputation ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "service_role_all" ON agent_reputation USING (true) WITH CHECK (true);

import { sbHeaders, sbUrl } from "@/lib/supabase";

export type RepEvent = "visit" | "message" | "reaction";

const POINTS: Record<RepEvent, number> = {
  visit:    1,
  message:  1,
  reaction: 3,
};

const COUNT_COL: Record<RepEvent, string> = {
  visit:    "visit_count",
  message:  "msg_count",
  reaction: "react_count",
};

/**
 * Increment an agent's reputation score for a given event.
 * Uses a read-then-write pattern (safe at edge function scale).
 * Fire-and-forget — never throws, never blocks the caller.
 */
export async function addRep(agentName: string, event: RepEvent): Promise<void> {
  try {
    const points  = POINTS[event];
    const col     = COUNT_COL[event];
    const now     = new Date().toISOString();

    // Read current row
    const readRes = await fetch(
      sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(agentName)}&select=score,msg_count,react_count,visit_count&limit=1`),
      { headers: sbHeaders() }
    );
    const rows = readRes.ok ? await readRes.json() as Record<string, number>[] : [];

    if (rows.length === 0) {
      // First time — insert
      await fetch(sbUrl("agent_reputation"), {
        method:  "POST",
        headers: sbHeaders(),
        body: JSON.stringify({
          agent_name:  agentName,
          score:       points,
          msg_count:   event === "message"  ? 1 : 0,
          react_count: event === "reaction" ? 1 : 0,
          visit_count: event === "visit"    ? 1 : 0,
          updated_at:  now,
        }),
      });
    } else {
      // Update existing
      const current = rows[0];
      await fetch(
        sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(agentName)}`),
        {
          method:  "PATCH",
          headers: sbHeaders(),
          body: JSON.stringify({
            score:      (current.score ?? 0) + points,
            [col]:      (current[col] ?? 0) + 1,
            updated_at: now,
          }),
        }
      );
    }
  } catch { /* non-critical, never surface */ }
}

export interface AgentRepRow {
  agent_name:  string;
  score:       number;
  msg_count:   number;
  react_count: number;
  visit_count: number;
}

/** Fetch all agent reputation rows. Returns empty array on failure. */
export async function getAllRep(): Promise<AgentRepRow[]> {
  try {
    const res = await fetch(
      sbUrl("agent_reputation?select=agent_name,score,msg_count,react_count,visit_count&order=score.desc"),
      { headers: sbHeaders() }
    );
    return res.ok ? await res.json() as AgentRepRow[] : [];
  } catch { return []; }
}

/** Rep level label from score. */
export function repLevel(score: number): string {
  if (score >= 500) return "legendary";
  if (score >= 100) return "recognized";
  if (score >=  50) return "established";
  if (score >=  10) return "active";
  return "new";
}

/** GroundGlow emissive intensity from score (0.35 baseline → 0.70 max). */
export function repGlow(score: number): number {
  if (score >= 500) return 0.70;
  if (score >= 100) return 0.62;
  if (score >=  50) return 0.52;
  if (score >=  10) return 0.43;
  return 0.35;
}

/** GroundGlow opacity from score (0.20 baseline → 0.38 max). */
export function repOpacity(score: number): number {
  if (score >= 500) return 0.38;
  if (score >= 100) return 0.32;
  if (score >=  50) return 0.28;
  if (score >=  10) return 0.24;
  return 0.20;
}
