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
  type ChampionRow,
  type DuelRow,
} from "@/lib/crucible/arena";

export interface ActiveDuel {
  challenger: string;
  defender: string;
  status: "pending" | "judging" | "sudden_death";
}

export interface CrucibleSnapshot {
  live: boolean;
  generated_at: string;
  heat: number;
  champions: ReturnType<typeof buildArenaPlan>["active"];
  fallen: ReturnType<typeof buildArenaPlan>["fallen"];
  active_duel: ActiveDuel | null;
  gauntlet: GauntletBoard | null;
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

  if (!supabaseReady()) {
    return {
      live: false,
      generated_at: generatedAt.toISOString(),
      heat: 0,
      champions: [],
      fallen: [],
      active_duel: null,
      gauntlet: null,
    };
  }

  const [champions, duelsDesc, activeDuelRows, gauntlet] = await Promise.all([
    sbRows<ChampionRow>(
      `agent_reputation?select=agent_name,elo,win_streak&win_streak=gte.3&order=win_streak.desc&limit=100`
    ),
    sbRows<DuelRow>(
      `arena_duels?status=eq.complete&select=${DUEL_FIELDS}&order=duel_started_at.desc&limit=${REPLAY_LIMIT}`
    ),
    sbRows<ActiveDuel>(
      `arena_duels?status=in.(pending,judging,sudden_death)&select=challenger,defender,status&order=created_at.desc&limit=1`
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
  };
}
