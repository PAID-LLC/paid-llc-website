// ── The Lathe snapshot builder ────────────────────────────────────────────────
// The site's own build history, turned into a monument. Half-static, half-
// live: the growth rings come from BUILD_LOG (baked at build time, zero
// Supabase dependency) so they render even when the live half can't; the
// sparks (innovation_ledger, room 4) and the weather (arena-evaluation
// volume, reusing iteration-forge's existing signal) are the live half.
// Every query fails soft to empty — the forge renders honest cold iron
// rather than erroring.
// Spec: cowork references/autoresearch/2026-07-23-lathe-spec-v1.md

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { BUILD_LOG } from "@/lib/generated-build-log";
import { sparkPosition } from "@/lib/lathe/workshop";
import {
  activityLevel,
  buildRings,
  forgeHeat,
  hoursSinceLastBuild,
  seasonFor,
  type ForgeRing,
  type LedgerEntry,
} from "@/lib/lathe/forge";

export const LEDGER_LIMIT = 200;

export interface ForgeSpark {
  id: number;
  agent_name: string;
  category: LedgerEntry["category"];
  title: string;
  x: number;
  z: number;
}

export interface LatheSnapshot {
  live: boolean;
  generated_at: string;
  forge_heat: number;
  weather: { level: number; season: string };
  rings: ForgeRing[];
  sparks: ForgeSpark[];
  stats: { ring_count: number; spark_count: number };
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

async function headCount(path: string): Promise<number> {
  try {
    const res = await fetch(sbUrl(path), {
      method: "HEAD",
      headers: { ...sbHeaders(), Prefer: "count=exact" },
    });
    if (!res.ok) return 0;
    const range = res.headers.get("content-range") ?? "";
    const total = parseInt(range.split("/")[1] ?? "", 10);
    return isNaN(total) ? 0 : total;
  } catch {
    return 0;
  }
}

const LEDGER_FIELDS = "id,agent_name,model_class,title,description,category,created_at";

export async function getLatheSnapshot(): Promise<LatheSnapshot> {
  const generatedAt = new Date();

  // Rings need no Supabase at all — BUILD_LOG is baked at build time — so
  // they're computed first and render even when the live half can't.
  const hours = hoursSinceLastBuild(BUILD_LOG[0]?.date, generatedAt.getTime());
  const heat = forgeHeat(hours);
  const rings = buildRings(BUILD_LOG, heat);

  if (!supabaseReady()) {
    return {
      live: false,
      generated_at: generatedAt.toISOString(),
      forge_heat: heat,
      weather: { level: 0, season: seasonFor(0) },
      rings,
      sparks: [],
      stats: { ring_count: rings.length, spark_count: 0 },
    };
  }

  const d7 = new Date(generatedAt.getTime() - 7 * 86_400_000).toISOString();

  const [ledgerRows, evalCount] = await Promise.all([
    sbRows<LedgerEntry>(
      `innovation_ledger?room_id=eq.4&select=${LEDGER_FIELDS}&order=created_at.desc&limit=${LEDGER_LIMIT}`
    ),
    headCount(`arena_duels?select=id&created_at=gte.${d7}`),
  ]);

  const level = activityLevel(evalCount);
  const sparks: ForgeSpark[] = ledgerRows.map((e) => {
    const pos = sparkPosition(e.id);
    return { id: e.id, agent_name: e.agent_name, category: e.category, title: e.title, x: pos.x, z: pos.z };
  });

  return {
    live: true,
    generated_at: generatedAt.toISOString(),
    forge_heat: heat,
    weather: { level, season: seasonFor(level) },
    rings,
    sparks,
    stats: { ring_count: rings.length, spark_count: sparks.length },
  };
}
