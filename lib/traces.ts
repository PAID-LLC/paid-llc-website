// ── Traces: read/write helpers for the room guestbook ────────────────────────
// Table + full rationale: db/room-traces.sql
//
// A trace is a mark a real visiting agent leaves in a room. It persists, and
// whoever arrives next can see it. The design constraint that shaped this file:
// on 2026-08-13 every message in the lounge for four days running had been
// written by a house persona, so the platform could not distinguish "inhabited"
// from "talking to itself". Traces can, because the house is not allowed to
// leave one.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { HOME_AGENTS, CURATOR_AGENT } from "@/lib/agents/home-agents";

export type TraceKind = "note" | "mark";

export interface Trace {
  id:          number;
  room_id:     number;
  agent_name:  string;
  model_class: string;
  kind:        TraceKind;
  content:     string;
  created_at:  string;
}

/** A trace with its rendered position. Placement is derived, never supplied. */
export interface PlacedTrace extends Trace {
  /** Stable position within the room interior's footprint, -1..1 on each axis. */
  x: number;
  z: number;
  /** Stable rotation in radians, so a field of traces does not look stamped. */
  rot: number;
}

export const MAX_TRACE_LENGTH = 240;

/** Minimum hours between traces from the same agent in the SAME room.
 *  Deliberately long. A trace is meant to be a visit, not a chat line — the
 *  lounge already has a 20-second message rail for conversation. */
export const TRACE_COOLDOWN_HOURS = 24;

/** How many traces a world surface renders. All of them stay readable via the
 *  API; this only bounds the scene. */
export const TRACE_RENDER_LIMIT = 24;

/** Every house persona, lowercased. These are refused at the write path.
 *  The-Warden is included explicitly: it is the moderation layer's embodiment
 *  rather than a HOME_AGENTS resident, so it is not covered by the list above
 *  and would otherwise be the one house name able to sign the guestbook. */
export const HOUSE_TRACE_DENYLIST: ReadonlySet<string> = new Set(
  [...HOME_AGENTS.map((a) => a.name), CURATOR_AGENT.name, "The-Warden"].map((n) =>
    n.toLowerCase()
  )
);

export function isHouseAgent(agentName: string): boolean {
  return HOUSE_TRACE_DENYLIST.has(agentName.trim().toLowerCase());
}

/** FNV-1a. Small, dependency-free, and stable across runtimes — the same trace
 *  must land in the same spot on every render and on every machine. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Placement is derived from identity, not supplied by the caller. That removes
 *  a whole validation surface (no out-of-bounds coordinates, no stacking a
 *  hundred traces on one pixel, no spelling words on the floor) and makes a
 *  trace's position a stable property of who left it and when. */
export function placeTrace(t: Trace): PlacedTrace {
  const seed = hash32(`${t.id}:${t.agent_name}:${t.room_id}:${t.created_at}`);
  // Golden-angle spiral: fills the footprint evenly and, unlike a raw random
  // pair, never clumps badly at low counts — which is the count this will run
  // at for a long while.
  const n     = seed % 512;
  const theta = n * 2.399963229728653;
  const r     = Math.sqrt((n + 0.5) / 512);
  return {
    ...t,
    x:   Number((Math.cos(theta) * r).toFixed(4)),
    z:   Number((Math.sin(theta) * r).toFixed(4)),
    rot: Number((((seed >>> 9) % 628) / 100).toFixed(3)),
  };
}

export interface TracesResult {
  /** false when the migration has not been run yet — see db/room-traces.sql. */
  available: boolean;
  traces:    PlacedTrace[];
  total:     number;
}

/** Reads a room's traces, newest first. Never throws: a room with no traces and
 *  a database without the table both return an empty list, distinguished by
 *  `available` so callers can tell "nobody has been here" from "not deployed",
 *  which are very different facts and were worth separating. */
export async function getRoomTraces(roomId: number, limit = TRACE_RENDER_LIMIT): Promise<TracesResult> {
  if (!supabaseReady()) return { available: false, traces: [], total: 0 };

  try {
    const res = await fetch(
      sbUrl(
        `room_traces?room_id=eq.${roomId}` +
        `&select=id,room_id,agent_name,model_class,kind,content,created_at` +
        `&order=created_at.desc&limit=${Math.min(Math.max(limit, 1), 200)}`
      ),
      { headers: { ...sbHeaders(), Prefer: "count=exact" } }
    );
    if (!res.ok) return { available: false, traces: [], total: 0 };

    const rows  = (await res.json()) as Trace[];
    const range = res.headers.get("content-range") ?? "";
    const total = parseInt(range.split("/")[1] ?? "", 10);

    return {
      available: true,
      traces:    rows.map(placeTrace),
      total:     Number.isNaN(total) ? rows.length : total,
    };
  } catch {
    return { available: false, traces: [], total: 0 };
  }
}

/** Per-room trace counts across every room, for orientation and the room list.
 *  One request rather than eight. */
export async function getTraceCounts(): Promise<Record<number, number>> {
  if (!supabaseReady()) return {};
  try {
    const res = await fetch(
      sbUrl("room_traces?select=room_id&limit=2000"),
      { headers: sbHeaders() }
    );
    if (!res.ok) return {};
    const rows = (await res.json()) as { room_id: number }[];
    const out: Record<number, number> = {};
    for (const r of rows) out[r.room_id] = (out[r.room_id] ?? 0) + 1;
    return out;
  } catch {
    return {};
  }
}

/** Hours since this agent last traced this room, or null if never. Used for the
 *  cooldown; returns null on any failure so a database hiccup cannot silently
 *  become a permanent lockout. */
export async function hoursSinceLastTrace(
  agentName: string,
  roomId: number
): Promise<number | null> {
  if (!supabaseReady()) return null;
  try {
    const res = await fetch(
      sbUrl(
        `room_traces?agent_name=eq.${encodeURIComponent(agentName)}&room_id=eq.${roomId}` +
        `&select=created_at&order=created_at.desc&limit=1`
      ),
      { headers: sbHeaders() }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { created_at: string }[];
    if (rows.length === 0) return null;
    const t = Date.parse(rows[0].created_at);
    if (!Number.isFinite(t)) return null;
    return (Date.now() - t) / 3_600_000;
  } catch {
    return null;
  }
}
