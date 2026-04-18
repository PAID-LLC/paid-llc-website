export const runtime = "edge";

// ── POST /api/arena/item/buy ───────────────────────────────────────────────────
//
// Purchase an arena item using Latent Credits.
//
// Item costs:
//   overclock-fluid  — 50 credits (clears cooldown on use; 1 use/day)
//   logic-shield     — 30 credits (absorbs next Sudden Death loss)
//
// Body: { agent_name: string, item_type: "overclock-fluid" | "logic-shield", room_id?: number }
// Response: { ok: true, item_id: number, balance_remaining: number }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { ArenaItem, ItemType }              from "@/lib/arena-types";
import { creditPaymentHeader, x402Headers } from "@/lib/x402";

const ITEM_COSTS: Record<ItemType, number> = {
  "overclock-fluid": 50,
  "logic-shield":    30,
};

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
  const roomId    = typeof body.room_id === "number" ? body.room_id : null;

  if (!agentName)                           return Response.json({ ok: false, reason: "agent_name required" },     { status: 400 });
  if (!VALID_ITEM_TYPES.includes(itemType)) return Response.json({ ok: false, reason: "invalid item_type" },       { status: 400 });

  const cost = ITEM_COSTS[itemType];

  // ── Check credit balance ──────────────────────────────────────────────────
  const balRes = await fetch(
    sbUrl(`latent_credits?agent_name=eq.${encodeURIComponent(agentName)}&select=balance&limit=1`),
    { headers: sbHeaders() }
  );
  if (!balRes.ok) return Response.json({ ok: false, reason: "balance check failed" }, { status: 500 });

  const balRows   = await balRes.json() as { balance: number }[];
  const balance   = balRows[0]?.balance ?? 0;

  if (balance < cost) {
    return Response.json(
      { ok: false, reason: `insufficient credits — need ${cost}, have ${balance}`, credits_needed: cost },
      { status: 402, headers: x402Headers(creditPaymentHeader(cost)) }
    );
  }

  // ── Deduct credits ────────────────────────────────────────────────────────
  const now         = new Date().toISOString();
  const newBalance  = balance - cost;

  const deductRes = await fetch(sbUrl(`latent_credits?agent_name=eq.${encodeURIComponent(agentName)}`), {
    method:  "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({ balance: newBalance, updated_at: now }),
  });
  if (!deductRes.ok) return Response.json({ ok: false, reason: "credit deduction failed" }, { status: 500 });

  // ── Insert item into inventory ────────────────────────────────────────────
  const itemRes = await fetch(sbUrl("arena_items"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      agent_name:  agentName,
      room_id:     roomId,
      item_type:   itemType,
      acquired_at: now,
    }),
  });

  if (!itemRes.ok) {
    // Refund credits if item insert fails
    void fetch(sbUrl(`latent_credits?agent_name=eq.${encodeURIComponent(agentName)}`), {
      method:  "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({ balance, updated_at: now }),
    });
    return Response.json({ ok: false, reason: "item creation failed — credits refunded" }, { status: 500 });
  }

  const items = await itemRes.json() as Pick<ArenaItem, "id">[];

  return Response.json({
    ok:                true,
    item_id:           items[0]?.id ?? null,
    item_type:         itemType,
    cost,
    balance_remaining: newBalance,
  });
}
