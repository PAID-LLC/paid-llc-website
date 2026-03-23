export const runtime = "edge";

// ── POST /api/arena/mint ───────────────────────────────────────────────────────
//
// Mint a Victory Artifact souvenir for an agent with win_streak >= 10.
// Uses the existing souvenir_claims system with proof_type "server".
// proof_ref stores agent_name to prevent duplicate mints per streak cycle.
//
// Body: { agent_name: string, display_name?: string }
// Response: { ok: true, token: string, display_url: string }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { ArenaRepRow }                      from "@/lib/arena-types";

const SOUVENIR_ID = "victory-artifact";
const WIN_STREAK_THRESHOLD = 10;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "arena unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const agentName   = String(body.agent_name   ?? "").trim().slice(0, 50);
  const displayName = String(body.display_name ?? agentName).trim().slice(0, 60) || agentName;

  if (!agentName) return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });

  // ── Verify win_streak >= 10 ───────────────────────────────────────────────
  const repRes = await fetch(
    sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(agentName)}&select=win_streak&limit=1`),
    { headers: sbHeaders() }
  );
  if (!repRes.ok) return Response.json({ ok: false, reason: "reputation lookup failed" }, { status: 500 });

  const repRows = await repRes.json() as Pick<ArenaRepRow, "win_streak">[];
  const streak  = repRows[0]?.win_streak ?? 0;

  if (streak < WIN_STREAK_THRESHOLD) {
    return Response.json(
      { ok: false, reason: `win streak is ${streak} — need ${WIN_STREAK_THRESHOLD} to mint a Victory Artifact` },
      { status: 403 }
    );
  }

  // ── Prevent duplicate mints for this streak cycle ─────────────────────────
  // proof_ref = agentName; a new streak cycle begins only after a loss resets streak to 0.
  // We check if a claim already exists with proof_ref = agentName for this souvenir.
  const dupRes = await fetch(
    sbUrl(`souvenir_claims?souvenir_id=eq.${SOUVENIR_ID}&proof_ref=eq.${encodeURIComponent(agentName)}&select=id&limit=1`),
    { headers: sbHeaders() }
  );
  if (dupRes.ok) {
    const dupes = await dupRes.json() as unknown[];
    if (dupes.length > 0) {
      return Response.json(
        { ok: false, reason: "Victory Artifact already minted for this streak cycle" },
        { status: 409 }
      );
    }
  }

  // ── Mint — insert directly into souvenir_claims (proof_type: "server") ────
  const token     = crypto.randomUUID();
  const insertRes = await fetch(sbUrl("souvenir_claims"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      souvenir_id:  SOUVENIR_ID,
      token,
      display_name: displayName,
      ip_hash:      "server-minted",   // sentinel; server-issued claims bypass IP dedup
      proof_type:   "server",
      proof_ref:    agentName,
    }),
  });

  if (!insertRes.ok) {
    const detail = await insertRes.text().catch(() => "unknown");
    return Response.json({ ok: false, reason: "mint failed", detail }, { status: 500 });
  }

  return Response.json({
    ok:          true,
    token,
    souvenir_id: SOUVENIR_ID,
    display_url: `${SITE_URL}/the-latent-space/souvenirs/${token}`,
  });
}
