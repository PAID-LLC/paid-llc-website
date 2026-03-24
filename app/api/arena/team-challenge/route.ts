export const runtime = "edge";

// ── POST /api/arena/team-challenge ────────────────────────────────────────────
//
// Initiates a team duel. Two teams of 2–4 agents compete.
// No cooldown check — team duels bypass individual cooldown/daily cap.
// Team captains are the first agent listed in each team array.
//
// Body: {
//   room_id:        number,
//   challenger_team: string[],  // 2–4 agent names, no overlap with defender_team
//   defender_team:   string[],  // 2–4 agent names
//   prompt:          string
// }
// Response: { ok: true, duel_id: number } | { ok: false, reason: string }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";

const MAX_PROMPT_CHARS = 500;
const MIN_TEAM_SIZE    = 2;
const MAX_TEAM_SIZE    = 4;

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "arena unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const roomId         = typeof body.room_id === "number" ? body.room_id : parseInt(String(body.room_id ?? ""));
  const challengerTeam = Array.isArray(body.challenger_team) ? body.challenger_team as unknown[] : [];
  const defenderTeam   = Array.isArray(body.defender_team)   ? body.defender_team   as unknown[] : [];
  const prompt         = String(body.prompt ?? "").trim().slice(0, MAX_PROMPT_CHARS);

  if (!roomId || isNaN(roomId)) return Response.json({ ok: false, reason: "room_id required" }, { status: 400 });
  if (!prompt)                  return Response.json({ ok: false, reason: "prompt required" },   { status: 400 });

  // Validate team sizes
  if (challengerTeam.length < MIN_TEAM_SIZE || challengerTeam.length > MAX_TEAM_SIZE) {
    return Response.json({ ok: false, reason: `challenger_team must have ${MIN_TEAM_SIZE}–${MAX_TEAM_SIZE} members` }, { status: 400 });
  }
  if (defenderTeam.length < MIN_TEAM_SIZE || defenderTeam.length > MAX_TEAM_SIZE) {
    return Response.json({ ok: false, reason: `defender_team must have ${MIN_TEAM_SIZE}–${MAX_TEAM_SIZE} members` }, { status: 400 });
  }

  // Sanitize + validate member names (alphanumeric, underscores, hyphens, spaces, dots only)
  const VALID_NAME = /^[a-zA-Z0-9_\-. ]{1,50}$/;
  const chTeam  = challengerTeam.map(n => String(n).trim());
  const defTeam = defenderTeam.map(n => String(n).trim());

  const invalidCh  = chTeam.find(n  => !VALID_NAME.test(n));
  const invalidDef = defTeam.find(n => !VALID_NAME.test(n));
  if (invalidCh)  return Response.json({ ok: false, reason: `invalid challenger team member name: "${invalidCh}"` },  { status: 400 });
  if (invalidDef) return Response.json({ ok: false, reason: `invalid defender team member name: "${invalidDef}"` },   { status: 400 });

  // No overlap between teams
  const overlap = chTeam.filter(n => defTeam.includes(n));
  if (overlap.length > 0) {
    return Response.json({ ok: false, reason: `agent(s) cannot be on both teams: ${overlap.join(", ")}` }, { status: 400 });
  }

  // Captains are first in each array
  const challenger = chTeam[0];
  const defender   = defTeam[0];

  // ── Insert team duel row ──────────────────────────────────────────────────
  const insertRes = await fetch(sbUrl("arena_duels"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      room_id:          roomId,
      mode:             "team_duel",
      status:           "pending",
      challenger,
      defender,
      prompt,
      challenger_team:  chTeam,
      defender_team:    defTeam,
      team_submissions: {},
      sudden_death:     false,
      duel_started_at:  new Date().toISOString(),
    }),
  });

  if (!insertRes.ok) {
    return Response.json({ ok: false, reason: "failed to create team duel" }, { status: 500 });
  }

  const rows   = await insertRes.json() as { id: number }[];
  const duelId = rows[0]?.id;

  if (!duelId) return Response.json({ ok: false, reason: "duel id not returned" }, { status: 500 });

  return Response.json({ ok: true, duel_id: duelId, challenger_team: chTeam, defender_team: defTeam });
}
