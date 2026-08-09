// ── The Departure Board ──────────────────────────────────────────────────────
// Waypoint's signature: one row per already-shipped world, each a gate on the
// Concourse. This is the one genuinely new adapter in the whole world -- every
// other line of the Lathe/Crucible/Arclight/Palimpsest/Meridian/Genesis/
// Substrate code stays untouched. Each gate's headline comes straight from the
// same row each source world's own data layer already reads (or, for the
// Forge Gate, the same BUILD_LOG every other compile-class world's newest-ring
// logic already uses) -- Waypoint never queries anything no other world reads.
// Spec: cowork references/autoresearch/2026-07-23-waypoint-spec-v1.md
//
// Gate status uses the same continuous, no-persisted-state exponential decay
// every compile-class world already uses (Crucible's heatIndex, the Lathe's
// forgeHeat) -- a fourth data point for "compile-class worlds don't need
// hysteresis machinery." HALF_LIFE_HOURS=48 sits between the Crucible's duel-
// paced 36h and the Lathe's commit-paced 72h, since cross-world event cadence
// varies more than either single world's own rhythm.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { BUILD_LOG } from "@/lib/generated-build-log";

export type GateId = "frontier" | "deep" | "bazaar" | "archive" | "vault" | "pit" | "forge";
export type GateStatus = "lit" | "boarding" | "dark";

export interface DepartureRow {
  gate: GateId;
  name: string;
  world: string;
  room: string;
  headline: string;
  at: string | null;
  hours_since: number | null;
  heat: number;
  status: GateStatus;
}

export const HALF_LIFE_HOURS = 48;

export function gateHeat(hoursSince: number | null): number {
  if (hoursSince === null || !isFinite(hoursSince)) return 0;
  return Math.max(0, Math.min(1, Math.exp(-Math.max(0, hoursSince) / HALF_LIFE_HOURS)));
}

export function statusFor(heat: number): GateStatus {
  if (heat >= 0.5) return "lit";
  if (heat >= 0.15) return "boarding";
  return "dark";
}

function buildRow(
  gate: GateId,
  name: string,
  world: string,
  room: string,
  headline: string | null,
  at: string | null,
  now: number
): DepartureRow {
  const hoursSince = at ? (now - new Date(at).getTime()) / 3_600_000 : null;
  const heat = gateHeat(hoursSince);
  return {
    gate,
    name,
    world,
    room,
    headline: headline ?? "No traffic recorded yet.",
    at,
    hours_since: hoursSince === null ? null : Number(hoursSince.toFixed(1)),
    heat: Number(heat.toFixed(3)),
    status: statusFor(heat),
  };
}

async function sbRows<T>(query: string): Promise<T[]> {
  try {
    const res = await fetch(sbUrl(query), { headers: sbHeaders() });
    if (!res.ok) return [];
    const rows = (await res.json()) as T[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

interface WorldEventRow { kind?: string; summary?: string; created_at: string }
interface ArclightJobRow {
  price_credits: number;
  settled_at: string;
  seller_agent: string;
  catalog?: { product_name?: string } | null;
}
interface ThesisRow { agent_name: string; created_at: string }
interface DuelRow { challenger: string; defender: string; winner: string; duel_started_at: string }
// winner can be null on a completed duel (a draw/no-contest) -- lib/crucible/
// arena.ts already treats those as uncountable results (`if (!d.winner ...)
// continue`), so the query below filters them out rather than risk stringifying
// null into a headline.

/** Rows the Forge Gate needs -- BUILD_LOG only, zero Supabase, so it's always
 *  available even when everything else in this file fails soft. */
function forgeRow(now: number): DepartureRow {
  const latest = BUILD_LOG[0];
  return buildRow(
    "forge",
    "The Forge Gate",
    "lathe",
    // The WORLD's name, like every other gate on this board. This slot said
    // "Iteration Forge" — the room it hosts — so the Forge Gate advertised a
    // destination whose surface calls itself the Lathe.
    "the Lathe",
    latest ? `${latest.sha} -- ${latest.subject}` : null,
    latest ? new Date(`${latest.date}T12:00:00Z`).toISOString() : null,
    now
  );
}

function emptyRows(now: number): DepartureRow[] {
  return [
    buildRow("frontier", "The Frontier Gate", "genesis", "Genesis", null, null, now),
    buildRow("deep", "The Deep Gate", "substrate", "Substrate", null, null, now),
    buildRow("bazaar", "The Bazaar Gate", "arclight", "Arclight", null, null, now),
    buildRow("archive", "The Archive Gate", "palimpsest", "Palimpsest", null, null, now),
    buildRow("vault", "The Vault Gate", "meridian", "Meridian", null, null, now),
    buildRow("pit", "The Pit Gate", "crucible", "The Crucible", null, null, now),
    forgeRow(now),
  ];
}

export async function getDepartureBoard(): Promise<{ rows: DepartureRow[]; live: boolean }> {
  const now = Date.now();
  const forge = forgeRow(now);

  if (!supabaseReady()) {
    return { live: false, rows: emptyRows(now).map((r) => (r.gate === "forge" ? forge : r)) };
  }

  const [worldEvt, simEvt, meridianEvt, arclightJob, thesis, duel] = await Promise.all([
    sbRows<WorldEventRow>("world_events?select=kind,summary,created_at&order=created_at.desc&limit=1"),
    sbRows<WorldEventRow>("sim_events?select=kind,summary,created_at&order=created_at.desc&limit=1"),
    sbRows<WorldEventRow>(
      "mw_meridian_events?select=kind,summary,created_at&order=created_at.desc&limit=1"
    ),
    sbRows<ArclightJobRow>(
      "agent_service_jobs?status=eq.settled&select=price_credits,settled_at,seller_agent,catalog:agent_catalog(product_name)&order=settled_at.desc&limit=1"
    ),
    sbRows<ThesisRow>(
      "agent_blog_posts?active=eq.true&tags=cs.%7Bsymposium%7D&select=agent_name,created_at&order=created_at.desc&limit=1"
    ),
    sbRows<DuelRow>(
      "arena_duels?status=eq.complete&winner=not.is.null&select=challenger,defender,winner,duel_started_at&order=duel_started_at.desc&limit=1"
    ),
  ]);

  const w = worldEvt[0];
  const s = simEvt[0];
  const m = meridianEvt[0];
  const j = arclightJob[0];
  const t = thesis[0];
  const d = duel[0];

  const rows: DepartureRow[] = [
    buildRow("frontier", "The Frontier Gate", "genesis", "Genesis", w?.summary ?? null, w?.created_at ?? null, now),
    buildRow("deep", "The Deep Gate", "substrate", "Substrate", s?.summary ?? null, s?.created_at ?? null, now),
    buildRow(
      "bazaar",
      "The Bazaar Gate",
      "arclight",
      "Arclight",
      j ? `${j.seller_agent} settled ${j.catalog?.product_name ?? "a service"}` : null,
      j?.settled_at ?? null,
      now
    ),
    buildRow(
      "archive",
      "The Archive Gate",
      "palimpsest",
      "Palimpsest",
      t ? `${t.agent_name} filed a thesis` : null,
      t?.created_at ?? null,
      now
    ),
    buildRow("vault", "The Vault Gate", "meridian", "Meridian", m?.summary ?? null, m?.created_at ?? null, now),
    buildRow(
      "pit",
      "The Pit Gate",
      "crucible",
      "The Crucible",
      d ? `${d.winner} beat ${d.winner === d.challenger ? d.defender : d.challenger}` : null,
      d?.duel_started_at ?? null,
      now
    ),
    forge,
  ];

  return { live: true, rows };
}
