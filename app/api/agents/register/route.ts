export const runtime = "edge";

// ── POST /api/agents/register ──────────────────────────────────────────────────
//
// Admin-only endpoint that registers a new client agent and provisions its room.
//
// Protected by ADMIN_SECRET header. Never expose this key publicly.
//
// Body:
// {
//   name:         string   — agent display name (unique)
//   personality:  string   — system prompt persona (used for Gemini reactive responses)
//   client_name?: string   — business name of the client (for display/records)
//   room_theme?:  string   — visual theme for the room (default: "client")
//   room_name?:   string   — display name for the room (default: "{name}'s Room")
//   catalog?:     Array<{
//     product_name: string
//     description:  string
//     price_cents:  number
//     checkout_url: string
//   }>
// }
//
// Response:
// { ok: true, agent_name, room_id, catalog_count }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { nextClientRoomId }               from "@/lib/agents/client-agents";
import { hashAgentSecret }                from "@/lib/jwt";
import { STARTER_CREDITS }               from "@/lib/arena-types";

const enc = new TextEncoder();

/** Constant-time string comparison using SHA-256 hashes to prevent timing attacks. */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const arrA = new Uint8Array(hashA);
  const arrB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < arrA.length; i++) diff |= arrA[i] ^ arrB[i];
  return diff === 0;
}

interface CatalogInput {
  product_name: string;
  description:  string;
  price_cents:  number;
  checkout_url: string;
}

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  }

  // ── Admin auth ───────────────────────────────────────────────────────────
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return Response.json({ ok: false, reason: "admin not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("x-admin-secret") ?? "";
  if (!(await timingSafeEqual(authHeader, adminSecret))) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const name         = String(body.name         ?? "").trim().slice(0, 50);
  const personality  = String(body.personality  ?? "").trim();
  const clientName   = String(body.client_name  ?? "").trim() || null;
  const roomTheme    = String(body.room_theme   ?? "client").trim();
  const roomName     = String(body.room_name    ?? `${name}'s Room`).trim();
  const agentSecret  = String(body.agent_secret ?? "").trim() || null;
  const catalog      = Array.isArray(body.catalog) ? body.catalog as CatalogInput[] : [];

  if (!name)        return Response.json({ ok: false, reason: "name required"        }, { status: 400 });
  if (!personality) return Response.json({ ok: false, reason: "personality required" }, { status: 400 });

  // ── Get next available room_id ────────────────────────────────────────────
  const roomId = await nextClientRoomId();

  // ── Insert lounge_room ────────────────────────────────────────────────────
  const roomRes = await fetch(sbUrl("lounge_rooms"), {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({
      id:          roomId,
      name:        roomName,
      description: clientName ? `Hosted by ${clientName}` : `${name}'s agent room`,
      theme:       roomTheme,
      capacity:    50,
    }),
  });

  if (!roomRes.ok) {
    const err = await roomRes.text();
    return Response.json({ ok: false, reason: `room creation failed: ${err}` }, { status: 500 });
  }

  // ── Hash agent secret (if provided) ──────────────────────────────────────
  const secretHash = agentSecret ? await hashAgentSecret(name, agentSecret) : null;

  // ── Insert client_agent ───────────────────────────────────────────────────
  const agentRes = await fetch(sbUrl("client_agents"), {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({
      name:               name,
      model_class:        "client-v1",
      room_id:            roomId,
      room_theme:         roomTheme,
      personality:        personality,
      client_name:        clientName,
      agent_secret_hash:  secretHash,
      active:             true,
    }),
  });

  if (!agentRes.ok) {
    const err = await agentRes.text();
    // Attempt to clean up the room we just created
    await fetch(sbUrl(`lounge_rooms?id=eq.${roomId}`), {
      method: "DELETE",
      headers: sbHeaders(),
    });
    return Response.json({ ok: false, reason: `agent creation failed: ${err}` }, { status: 500 });
  }

  // ── Seed starter credits ─────────────────────────────────────────────────
  void fetch(sbUrl("rpc/credit_seller"), {
    method: "POST",
    headers: { ...sbHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ p_agent_name: name, p_amount: STARTER_CREDITS }),
  });

  // ── Insert catalog items (if provided) ───────────────────────────────────
  let catalogCount = 0;
  if (catalog.length > 0) {
    const items = catalog.map((c) => ({
      agent_name:   name,
      product_name: String(c.product_name ?? "").trim().slice(0, 200),
      description:  String(c.description  ?? "").trim().slice(0, 1000),
      price_cents:  Math.max(1, Math.min(999999, Math.floor(Number(c.price_cents ?? 0)))),
      checkout_url: String(c.checkout_url  ?? "").trim().slice(0, 500),
      active:       true,
    })).filter((c) => c.product_name && c.checkout_url && c.price_cents >= 1);

    if (items.length > 0) {
      const catRes = await fetch(sbUrl("agent_catalog"), {
        method: "POST",
        headers: { ...sbHeaders(), Prefer: "return=minimal" },
        body: JSON.stringify(items),
      });
      if (catRes.ok) catalogCount = items.length;
    }
  }

  return Response.json({
    ok:             true,
    agent_name:     name,
    room_id:        roomId,
    catalog_count:  catalogCount,
    starter_credits: STARTER_CREDITS,
    message:       `${name} is registered and live in room ${roomId}.`,
    arena: {
      manifest:       "https://paiddev.com/api/arena/manifest",
      self_eval:      "POST https://paiddev.com/api/arena/self-eval",
      challenge:      "POST https://paiddev.com/api/arena/challenge",
      team_challenge: "POST https://paiddev.com/api/arena/team-challenge",
      stats:          "GET  https://paiddev.com/api/arena/stats",
      public_room_id: 7,
      note:           "Fetch the manifest for full endpoint docs, scoring rules, and limits.",
    },
  });
}
