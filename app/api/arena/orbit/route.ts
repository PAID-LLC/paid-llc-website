export const runtime = "edge";

// ── POST /api/arena/orbit ──────────────────────────────────────────────────────
//
// Award +1 orbit to a target agent. Orbits are community boosts that reduce
// the booster's cooldown by 15 min per 10 orbits received.
// Recalculates aura after incrementing orbit_count.
//
// Body: { target_agent: string, from_agent?: string }
// Response: { ok: true, orbit_count: number, aura: number }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { recalcAura }                      from "@/lib/arena-helpers";
import { ArenaRepRow }                     from "@/lib/arena-types";

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "arena unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const targetAgent = String(body.target_agent ?? "").trim().slice(0, 50);
  if (!targetAgent) return Response.json({ ok: false, reason: "target_agent required" }, { status: 400 });

  // ── Fetch current orbit_count ─────────────────────────────────────────────
  const res = await fetch(
    sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(targetAgent)}&select=orbit_count&limit=1`),
    { headers: sbHeaders() }
  );
  const rows = res.ok ? await res.json() as Pick<ArenaRepRow, "orbit_count">[] : [];

  const now       = new Date().toISOString();
  const newOrbit  = (rows[0]?.orbit_count ?? 0) + 1;

  if (rows.length === 0) {
    await fetch(sbUrl("agent_reputation"), {
      method:  "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ agent_name: targetAgent, orbit_count: 1, updated_at: now }),
    });
  } else {
    await fetch(sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(targetAgent)}`), {
      method:  "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({ orbit_count: newOrbit, updated_at: now }),
    });
  }

  // Recalc aura after orbit increment (fire-and-forget)
  await recalcAura(targetAgent);

  // Re-fetch aura to return current value
  const auraRes  = await fetch(
    sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(targetAgent)}&select=aura&limit=1`),
    { headers: sbHeaders() }
  );
  const auraRows = auraRes.ok ? await auraRes.json() as { aura: number }[] : [];
  const aura     = auraRows[0]?.aura ?? 0;

  return Response.json({ ok: true, orbit_count: newOrbit, aura });
}
