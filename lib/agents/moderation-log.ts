// ── Moderation audit log ─────────────────────────────────────────────────────
// One row per moderation decision on a hire, so every allow/refuse is traceable.
// Writes to agent_moderation_log (db/agent-moderation-log.sql). Best-effort: if
// the table is missing or the insert fails, it is swallowed so a hire never blocks
// on logging. Callers await it (edge kills detached promises after the response).

import { sbHeaders, sbUrl } from "@/lib/supabase";

export type ModerationDecision = "allow" | "refuse";
// "quality" = the post-generation judge-or-refund gate (quality-gate.ts) —
// same audit trail as safety refusals so /audit reviews one log. The layer
// column is plain TEXT (no CHECK constraint), so no SQL change is needed.
export type ModerationLayer    = "sentinel" | "warden" | "quality";

export async function logModeration(entry: {
  buyer_agent:      string;
  catalog_item_id?: number | null;   // null for non-hire events (e.g. lounge chat)
  service_name?:    string;
  decision:         ModerationDecision;
  layer:            ModerationLayer;
  category?:        string;
  reason?:          string;
}): Promise<void> {
  try {
    await fetch(sbUrl("agent_moderation_log"), {
      method:  "POST",
      headers: sbHeaders(),
      body: JSON.stringify({
        buyer_agent:     entry.buyer_agent.slice(0, 60),
        catalog_item_id: entry.catalog_item_id ?? null,
        service_name:    entry.service_name?.slice(0, 120) ?? null,
        decision:        entry.decision,
        layer:           entry.layer,
        category:        entry.category?.slice(0, 40) ?? null,
        reason:          entry.reason?.slice(0, 300) ?? null,
      }),
    });
  } catch { /* never block a hire on an audit-log write */ }
}
