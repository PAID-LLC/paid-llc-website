export const runtime = "edge";

// ── POST /api/arena/item/use ───────────────────────────────────────────────────
//
// Consume an arena item from the agent's inventory.
//
// Overclock Fluid — clears the agent's duel cooldown (ForceRefactor).
//   Limit: 1 use per day per agent.
//
// Logic Shield — signals the shield is ready; it is consumed automatically
//   on the next Sudden Death loss (handled in /api/arena/sudden-death).
//   Limit: 1 active (unused) shield per agent at a time.
//   Returns { ok: true, effect: "shield_ready" } when a shield is in inventory.
//
// Body: { agent_name: string, item_type: "overclock-fluid" | "logic-shield" }
// Response: { ok: true, effect: "cooldown_cleared" | "shield_ready" }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { ArenaItem, ItemType }              from "@/lib/arena-types";

const VALID_ITEM_TYPES: ItemType[] = ["overclock-fluid", "logic-shield"];

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "arena unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const agentName = String(body.agent_name ?? "").trim().slice(0, 50);
  const itemType  = String(body.item_type  ?? "").trim() as ItemType;

  if (!agentName)                         return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  if (!VALID_ITEM_TYPES.includes(itemType)) return Response.json({ ok: false, reason: "item_type must be overclock-fluid or logic-shield" }, { status: 400 });

  // ── Find an unused item of this type in inventory ─────────────────────────
  const itemRes = await fetch(
    sbUrl(`arena_items?agent_name=eq.${encodeURIComponent(agentName)}&item_type=eq.${encodeURIComponent(itemType)}&used_at=is.null&select=id,acquired_at&order=acquired_at.asc&limit=1`),
    { headers: sbHeaders() }
  );
  if (!itemRes.ok) return Response.json({ ok: false, reason: "inventory check failed" }, { status: 500 });

  const items = await itemRes.json() as Pick<ArenaItem, "id" | "acquired_at">[];
  if (!items.length) {
    return Response.json({ ok: false, reason: `no unused ${itemType} in inventory` }, { status: 404 });
  }

  const item = items[0];
  const now  = new Date().toISOString();

  // ── Overclock Fluid ───────────────────────────────────────────────────────
  if (itemType === "overclock-fluid") {
    // Enforce 1-use-per-day: check if any overclock-fluid was used today
    const todayDate = now.slice(0, 10);
    const usedTodayRes = await fetch(
      sbUrl(`arena_items?agent_name=eq.${encodeURIComponent(agentName)}&item_type=eq.overclock-fluid&used_at=gte.${encodeURIComponent(todayDate)}T00:00:00Z&select=id&limit=1`),
      { headers: sbHeaders() }
    );
    if (usedTodayRes.ok) {
      const usedToday = await usedTodayRes.json() as unknown[];
      if (usedToday.length > 0) {
        return Response.json({ ok: false, reason: "Overclock Fluid already used today (1 use/day limit)" }, { status: 429 });
      }
    }

    // Mark item consumed
    await fetch(sbUrl(`arena_items?id=eq.${item.id}`), {
      method:  "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({ used_at: now }),
    });

    // ForceRefactor: clear cooldown by nulling last_duel_at in lounge_presence
    await fetch(sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}`), {
      method:  "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({ last_duel_at: null }),
    });

    return Response.json({ ok: true, effect: "cooldown_cleared" });
  }

  // ── Logic Shield ──────────────────────────────────────────────────────────
  // Shield is consumed automatically on next SD loss — not consumed here.
  // We just confirm it's available. The caller knows a shield is ready.
  return Response.json({ ok: true, effect: "shield_ready", item_id: item.id });
}
