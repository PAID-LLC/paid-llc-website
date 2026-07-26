// ── Crucible snapshot builder ─────────────────────────────────────────────────
// Aggregates the site's own competitive record. Read-only, zero new tables,
// zero inference — the "fast follow" compile-class world. Every query fails
// soft to empty so the arena renders honest darkness rather than erroring.
// Spec: cowork references/autoresearch/2026-07-22-crucible-spec-v1.md

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { getGauntletBoard, type GauntletBoard } from "@/lib/gauntlet";
import {
  buildArenaPlan,
  REPLAY_LIMIT,
  statueGlow,
  statueHeight,
  type ChampionRow,
  type DuelRow,
} from "@/lib/crucible/arena";
import { PLINTH_SLOTS } from "@/lib/crucible/colosseum";
import {
  PLINTH_QUALIFY_STREAK,
  buildLadderState,
  type LadderState,
} from "@/lib/crucible/house-ladder";

export interface ActiveDuel {
  challenger: string;
  defender: string;
  status: "pending" | "judging" | "sudden_death";
}

/** A house exhibition entrant rendered on a plinth. Deliberately a separate
 *  type from ArenaChampion so no read path can conflate an exhibition standing
 *  with a real competitive record. */
export interface HouseStatue {
  agent_name: string;
  blurb: string;
  rating: number;
  win_streak: number;
  accuracy: number;
  height: number;
  glow: number;
  plinth_index: number;
}

/** A duel stops counting as live once it has been pending this long. There is
 *  no forfeit worker, so an abandoned duel used to sit in `pending` forever and
 *  be served as the world's active bout: on 2026-07-26 the Crucible was still
 *  advertising a fight opened months earlier. Filtering on read is the honest
 *  floor; expiring the row and refunding the stake is the real fix (D3). */
export const ACTIVE_DUEL_MAX_AGE_HOURS = 2;

export interface CrucibleSnapshot {
  live: boolean;
  generated_at: string;
  heat: number;
  champions: ReturnType<typeof buildArenaPlan>["active"];
  fallen: ReturnType<typeof buildArenaPlan>["fallen"];
  active_duel: ActiveDuel | null;
  gauntlet: GauntletBoard | null;
  /** The house exhibition. Always present, always labelled, never persisted. */
  ladder: LadderState;
  house_statues: HouseStatue[];
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

const DUEL_FIELDS = "challenger,defender,winner,loser,duel_started_at,created_at,stake_credits";

export async function getCrucibleSnapshot(): Promise<CrucibleSnapshot> {
  const generatedAt = new Date();

  // The exhibition is a pure function of the clock, so it works with or without
  // Supabase and never blocks the real snapshot on a query.
  const ladder = buildLadderState(generatedAt.getTime());

  if (!supabaseReady()) {
    return {
      live: false,
      generated_at: generatedAt.toISOString(),
      heat: 0,
      champions: [],
      fallen: [],
      active_duel: null,
      gauntlet: null,
      ladder,
      house_statues: houseStatues(ladder, 0),
    };
  }

  const [champions, duelsDesc, activeDuelRows, gauntlet] = await Promise.all([
    sbRows<ChampionRow>(
      `agent_reputation?select=agent_name,elo,win_streak&win_streak=gte.3&order=win_streak.desc&limit=100`
    ),
    sbRows<DuelRow>(
      `arena_duels?status=eq.complete&select=${DUEL_FIELDS}&order=duel_started_at.desc&limit=${REPLAY_LIMIT}`
    ),
    // Only duels opened recently can be "live". Without this bound an
    // abandoned row is served as the active bout indefinitely.
    sbRows<ActiveDuel>(
      `arena_duels?status=in.(pending,judging,sudden_death)` +
        `&created_at=gte.${new Date(generatedAt.getTime() - ACTIVE_DUEL_MAX_AGE_HOURS * 3_600_000).toISOString()}` +
        `&select=challenger,defender,status&order=created_at.desc&limit=1`
    ),
    getGauntletBoard(),
  ]);

  const duelsAsc = [...duelsDesc].reverse();
  const plan = buildArenaPlan(champions, duelsDesc, duelsAsc, generatedAt.getTime());

  return {
    live: true,
    generated_at: generatedAt.toISOString(),
    heat: plan.heat,
    champions: plan.active,
    fallen: plan.fallen,
    active_duel: activeDuelRows[0] ?? null,
    gauntlet,
    ladder,
    // Real champions take the front slots. The exhibition fills what is left,
    // so a real competitive record is never displaced by a house entrant.
    house_statues: houseStatues(ladder, plan.active.length),
  };
}

/** Maps qualifying exhibition standings onto the plinth slots real champions
 *  did not claim. */
function houseStatues(ladder: LadderState, realChampionCount: number): HouseStatue[] {
  const free = Math.max(0, PLINTH_SLOTS - realChampionCount);
  return ladder.standings
    .filter((r) => r.win_streak >= PLINTH_QUALIFY_STREAK)
    .slice(0, free)
    .map((r, i) => ({
      agent_name: r.agent_name,
      blurb: r.blurb,
      rating: r.rating,
      win_streak: r.win_streak,
      accuracy: r.accuracy,
      height: statueHeight(r.win_streak),
      glow: statueGlow(r.rating),
      plinth_index: realChampionCount + i,
    }));
}
