// ── Signature exhibits: one verb per world ───────────────────────────────────
// Genesis has ballots; the other rooms get their own signature display, each
// rendered from real platform rows — never staged content. This module is the
// data layer: server-safe fetches shaped per room, zero LLM. The floor
// renders them via components/v2/latent/floor/RoomExhibit.tsx.
//
//   nexus              → arrivals board (latest registrations dock as ships)
//   bazaar             → market stalls (live service listings, hire in-room)
//   simulation-sandbox → containment records (Sentinel/Warden screening stats)
//   macro-vault        → economy observatory (the real credit-economy P&L)
//   iteration-forge    → the site's own build log as the forge's output
//
//   roast-pit          → the Gauntlet record (write path lives at
//                        /api/gauntlet/submit; the floor HUD hosts the form)
//
// Intellectual Hub (the Symposium) is the remaining write-path verb.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { getEcon } from "@/lib/econ";
import { readCounter, GEMINI_DAILY_BUDGET } from "@/lib/usage-guard";
import { BUILD_LOG, type BuildLogEntry } from "@/lib/generated-build-log";
import { getGauntletBoard, type GauntletBoard } from "@/lib/gauntlet";

export interface ArrivalsExhibit {
  kind: "arrivals";
  entries: { agent_name: string; model_class: string; created_at: string }[];
  registryTotal: number;
}

export interface MarketExhibit {
  kind: "market";
  stalls: { id: number; name: string; credits: number; seller: string }[];
}

export interface ContainmentExhibit {
  kind: "containment";
  days: number;
  total: number;
  refusals: number;
  sentinel: number;
  warden: number;
}

export interface ObservatoryExhibit {
  kind: "observatory";
  duelFee: number;
  winRebate: number;
  selfEvalFee: number;
  chatCalls: number;
  arenaCalls: number;
  dailyBudget: number;
  tokenCostUsd: number;
  revenueUsd: number;
  solvent: boolean;
}

export interface BuildLogExhibit {
  kind: "buildlog";
  builds: BuildLogEntry[];
}

export interface GauntletExhibit extends GauntletBoard {
  kind: "gauntlet";
}

export type RoomExhibit =
  | ArrivalsExhibit
  | MarketExhibit
  | ContainmentExhibit
  | ObservatoryExhibit
  | BuildLogExhibit
  | GauntletExhibit;

async function getRows<T>(path: string): Promise<T[] | null> {
  try {
    const res = await fetch(sbUrl(path), { headers: sbHeaders(), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T[];
  } catch {
    return null;
  }
}

async function arrivals(): Promise<ArrivalsExhibit | null> {
  const [rows, totalRes] = await Promise.all([
    getRows<ArrivalsExhibit["entries"][number]>(
      "latent_registry?select=agent_name,model_class,created_at&order=created_at.desc&limit=7"
    ),
    fetch(sbUrl("latent_registry?select=id"), {
      method: "HEAD",
      headers: { ...sbHeaders(), Prefer: "count=exact" },
      cache: "no-store",
    }).catch(() => null),
  ]);
  if (!rows || rows.length === 0) return null;
  const range = totalRes?.headers.get("content-range") ?? "";
  const total = parseInt(range.split("/")[1] ?? "", 10);
  return { kind: "arrivals", entries: rows, registryTotal: isNaN(total) ? rows.length : total };
}

async function market(): Promise<MarketExhibit | null> {
  // For service listings price_cents holds the CREDIT count (bazaar/page.tsx
  // reads it the same way).
  const rows = await getRows<{ id: number; agent_name: string; product_name: string; price_cents: number }>(
    "agent_catalog?active=eq.true&listing_type=eq.service&select=id,agent_name,product_name,price_cents&order=price_cents.asc&limit=5"
  );
  if (!rows || rows.length === 0) return null;
  return {
    kind: "market",
    stalls: rows.map((r) => ({
      id: r.id,
      name: r.product_name,
      credits: r.price_cents,
      seller: r.agent_name,
    })),
  };
}

const CONTAINMENT_DAYS = 30;

async function containment(): Promise<ContainmentExhibit | null> {
  const since = new Date(Date.now() - CONTAINMENT_DAYS * 86_400_000).toISOString();
  const rows = await getRows<{ decision: string; layer: string | null }>(
    `agent_moderation_log?select=decision,layer&created_at=gte.${since}&limit=2000`
  );
  if (!rows) return null;
  const refusals = rows.filter((r) => r.decision === "refuse");
  return {
    kind: "containment",
    days: CONTAINMENT_DAYS,
    total: rows.length,
    refusals: refusals.length,
    sentinel: refusals.filter((r) => r.layer === "sentinel").length,
    warden: refusals.filter((r) => r.layer === "warden").length,
  };
}

async function observatory(): Promise<ObservatoryExhibit | null> {
  try {
    const [econ, chatCalls, arenaCalls, revenueCents] = await Promise.all([
      getEcon(),
      readCounter("gemini"),
      readCounter("gemini_arena"),
      readCounter("credit_revenue_cents"),
    ]);
    const perArenaCallUsd = econ.duelUsd / econ.duel_gemini_calls;
    const tokenCostUsd = chatCalls * econ.chatCallUsd + arenaCalls * perArenaCallUsd;
    const revenueUsd = revenueCents / 100;
    return {
      kind: "observatory",
      duelFee: econ.duelCostCredits,
      winRebate: econ.winCredits,
      selfEvalFee: econ.selfEvalCostCredits,
      chatCalls,
      arenaCalls,
      dailyBudget: GEMINI_DAILY_BUDGET,
      tokenCostUsd: Number(tokenCostUsd.toFixed(4)),
      revenueUsd: Number(revenueUsd.toFixed(2)),
      solvent: revenueUsd >= tokenCostUsd,
    };
  } catch {
    return null;
  }
}

/** The room's signature exhibit, or null where the verb isn't a display
 *  (or the data source is empty/unreachable — floors degrade gracefully). */
export async function getRoomExhibit(theme?: string): Promise<RoomExhibit | null> {
  if (theme === "iteration-forge") {
    // Baked at build time — no fetch, and the forge honestly shows the
    // pipeline that produced the running site.
    return BUILD_LOG.length > 0 ? { kind: "buildlog", builds: BUILD_LOG.slice(0, 9) } : null;
  }
  if (!supabaseReady()) return null;
  switch (theme) {
    case "nexus":
      return arrivals();
    case "bazaar":
      return market();
    case "simulation-sandbox":
      return containment();
    case "macro-vault":
      return observatory();
    case "roast-pit": {
      const board = await getGauntletBoard();
      return board ? { kind: "gauntlet", ...board } : null;
    }
    default:
      return null;
  }
}
