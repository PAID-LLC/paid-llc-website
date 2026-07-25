// ── World Residents: the deterministic tick engine ───────────────────────────
// Spec: cowork references/autoresearch/2026-07-25-world-residents-spec-v1.md
//
// Arclight, the Crucible, Palimpsest, the Lathe and Waypoint are compiler
// worlds — they render real platform data and go dark when it is empty. This
// engine gives each of them four residents who work and build inside the world
// itself, so a world with no commerce still has inhabitants.
//
// HONESTY CONTRACT: this module writes to world_resident_state,
// world_residents, world_builds and world_resident_events. NOTHING ELSE. It
// never touches arena_duels, sales_ledger, agent_service_jobs,
// agent_blog_posts or latent_registry, so no compiled world ever reports
// activity that did not really happen. Arclight still shows 0 sales; Waypoint
// still shows dark gates. Residents are life inside the world, not a claim
// about the business.
//
// Fully deterministic — zero Gemini calls, so this never competes for the
// shared 1,000/day budget and never stalls when that budget is spent. Variety
// comes from a seeded PRNG (tick + resident name), which also makes every tick
// reproducible for tests.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { hashStr, mulberry32 } from "@/lib/sim-field";
import {
  ACTORS_PER_TICK, MAX_BUILDS_PER_WORLD, MOVE_SPEED, ROAM_RADIUS,
  NEXT_GOALS, RESIDENT_WORLDS, WORLD_CONFIG,
  type ResidentWorld,
} from "@/lib/residents/cast";

export interface ResidentRow {
  id: number;
  world: string;
  name: string;
  epithet: string;
  archetype: string;
  color: string;
  drives: Record<string, number>;
  x: number;
  z: number;
  energy: number;
  mood: string;
  activity: string;
  goal: string;
  goal_kind: string;
  goal_progress: number;
  goal_target: number;
  updated_at: string;
}

export interface BuildRow {
  id: number;
  world: string;
  kind: string;
  x: number;
  z: number;
  built_by: string;
  tick: number;
  created_at: string;
}

export interface ResidentEvent {
  id: number;
  world: string;
  kind: string;
  summary: string;
  detail: Record<string, unknown>;
  tick: number;
  created_at: string;
}

export interface WorldStateRow {
  world: string;
  frozen: boolean;
  tick: number;
  updated_at: string;
}

export type ResidentAction = "move" | "build" | "tend" | "study" | "rest";

// ── Supabase helpers (same shape as lib/simworld.ts) ─────────────────────────

async function sbGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(sbUrl(path), { headers: sbHeaders(), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function sbWrite(path: string, method: "POST" | "PATCH", body: unknown): Promise<boolean> {
  try {
    const res = await fetch(sbUrl(path), { method, headers: sbHeaders(), body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Pure helpers (exported for tests) ────────────────────────────────────────

/** Keep a resident inside the world's roam disc. */
export function clampToRoam(x: number, z: number): { x: number; z: number } {
  const d = Math.hypot(x, z);
  if (d <= ROAM_RADIUS) return { x, z };
  const s = ROAM_RADIUS / d;
  return { x: x * s, z: z * s };
}

/**
 * Drive-weighted action choice. Deterministic given (resident, tick).
 *
 * Weights are deliberately simple and total-ordered by drive so a builder
 * builds and a scholar studies, but every resident can still do anything —
 * a world where each resident only ever does one thing reads as a loop.
 */
export function chooseAction(
  r: Pick<ResidentRow, "name" | "drives" | "energy" | "goal_kind">,
  tick: number,
  buildsFull: boolean
): ResidentAction {
  if (r.energy <= 20) return "rest";

  const d = r.drives ?? {};
  const industry = Number(d.industry ?? 3);
  const curiosity = Number(d.curiosity ?? 3);
  const order = Number(d.order ?? 3);
  const vigor = Number(d.vigor ?? 3);

  const weights: Record<ResidentAction, number> = {
    build: buildsFull ? 0 : industry * 2,
    tend: order * 2,
    study: curiosity * 2,
    move: vigor * 2,
    rest: 1,
  };

  // A resident pushes toward its own goal: the matching action gets a boost,
  // so goals actually complete instead of drifting forever.
  if (r.goal_kind && r.goal_kind in weights) {
    weights[r.goal_kind as ResidentAction] += 5;
  }
  if (buildsFull) weights.build = 0;

  const rng = mulberry32(hashStr(`${r.name}:${tick}`));
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total <= 0) return "rest";

  let roll = rng() * total;
  for (const [action, w] of Object.entries(weights) as [ResidentAction, number][]) {
    roll -= w;
    if (roll <= 0) return action;
  }
  return "rest";
}

/** Which residents act on this tick — rotates so everyone gets turns. */
export function actorsForTick(residents: ResidentRow[], tick: number): ResidentRow[] {
  if (residents.length === 0) return [];
  const out: ResidentRow[] = [];
  for (let i = 0; i < Math.min(ACTORS_PER_TICK, residents.length); i++) {
    out.push(residents[(tick * ACTORS_PER_TICK + i) % residents.length]);
  }
  return out;
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function bearing(x: number, z: number): string {
  const ns = z < -8 ? "north" : z > 8 ? "south" : "";
  const ew = x < -8 ? "west" : x > 8 ? "east" : "";
  return ns + ew || "centre";
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getWorldState(world: ResidentWorld): Promise<WorldStateRow | null> {
  const rows = await sbGet<WorldStateRow[]>(
    `world_resident_state?world=eq.${world}&select=world,frozen,tick,updated_at&limit=1`
  );
  return rows?.[0] ?? null;
}

export async function getResidents(world: ResidentWorld): Promise<ResidentRow[]> {
  return (await sbGet<ResidentRow[]>(`world_residents?world=eq.${world}&select=*&order=id.asc`)) ?? [];
}

export async function getBuilds(world: ResidentWorld, limit = 60): Promise<BuildRow[]> {
  return (
    (await sbGet<BuildRow[]>(
      `world_builds?world=eq.${world}&select=*&order=created_at.desc&limit=${limit}`
    )) ?? []
  );
}

export async function getResidentEvents(world: ResidentWorld, limit = 30): Promise<ResidentEvent[]> {
  return (
    (await sbGet<ResidentEvent[]>(
      `world_resident_events?world=eq.${world}&select=*&order=created_at.desc&limit=${limit}`
    )) ?? []
  );
}

/** Everything one world's panel needs, in one call. */
export async function getResidentSnapshot(world: ResidentWorld) {
  const [state, residents, builds, events] = await Promise.all([
    getWorldState(world),
    getResidents(world),
    getBuilds(world, 40),
    getResidentEvents(world, 20),
  ]);
  return {
    initialized: state !== null && residents.length > 0,
    world,
    tick: state?.tick ?? 0,
    frozen: state?.frozen ?? false,
    residents,
    builds,
    events,
  };
}

// ── The tick ─────────────────────────────────────────────────────────────────

export interface WorldTickResult {
  world: string;
  initialized: boolean;
  frozen?: boolean;
  tick?: number;
  acted?: string[];
  events?: number;
}

async function appendEvent(
  world: ResidentWorld,
  kind: "work" | "build" | "goal" | "rest" | "arrival",
  summary: string,
  detail: Record<string, unknown>,
  tick: number
): Promise<boolean> {
  return sbWrite("world_resident_events", "POST", { world, kind, summary, detail, tick });
}

/**
 * Advance one world by a single tick. Two residents act; each writes at most
 * one event. Deterministic: same (tick, resident) always resolves the same way.
 */
export async function runWorldResidentTick(world: ResidentWorld): Promise<WorldTickResult> {
  const state = await getWorldState(world);
  if (!state) return { world, initialized: false };
  if (state.frozen) return { world, initialized: true, frozen: true, tick: state.tick };

  const residents = await getResidents(world);
  if (residents.length === 0) return { world, initialized: false };

  const tick = state.tick + 1;
  const cfg = WORLD_CONFIG[world];
  const builds = await getBuilds(world, MAX_BUILDS_PER_WORLD + 1);
  const buildsFull = builds.length >= MAX_BUILDS_PER_WORLD;

  const acted: string[] = [];
  let eventCount = 0;

  for (const r of actorsForTick(residents, tick)) {
    const rng = mulberry32(hashStr(`${world}:${r.name}:${tick}`));
    const action = chooseAction(r, tick, buildsFull);

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let summary: string | null = null;
    let kind: "work" | "build" | "goal" | "rest" = "work";

    if (action === "rest") {
      patch.energy = Math.min(100, r.energy + 25);
      patch.activity = pick(cfg.resting, rng);
      patch.mood = "steady";
      kind = "rest";
      summary = `${r.name} is ${patch.activity}.`;
    } else if (action === "move") {
      const angle = rng() * Math.PI * 2;
      const next = clampToRoam(r.x + Math.cos(angle) * MOVE_SPEED, r.z + Math.sin(angle) * MOVE_SPEED);
      patch.x = Number(next.x.toFixed(2));
      patch.z = Number(next.z.toFixed(2));
      patch.energy = Math.max(0, r.energy - 6);
      patch.activity = `crossing ${cfg.ground}`;
      summary = `${r.name} crosses ${cfg.ground} toward the ${bearing(next.x, next.z)}.`;
    } else if (action === "build") {
      const kindBuilt = pick(cfg.builds, rng);
      const bx = Number(clampToRoam(r.x + (rng() - 0.5) * 8, r.z + (rng() - 0.5) * 8).x.toFixed(2));
      const bz = Number(clampToRoam(r.x + (rng() - 0.5) * 8, r.z + (rng() - 0.5) * 8).z.toFixed(2));
      await sbWrite("world_builds", "POST", {
        world, kind: kindBuilt, x: bx, z: bz, built_by: r.name, tick,
      });
      patch.energy = Math.max(0, r.energy - 12);
      patch.activity = `raising a ${kindBuilt}`;
      patch.mood = "absorbed";
      kind = "build";
      summary = `${r.name} raises a ${kindBuilt} on ${cfg.ground} — the ${ordinal(builds.length + 1)} standing.`;
    } else if (action === "tend") {
      patch.energy = Math.max(0, r.energy - 8);
      patch.activity = pick(cfg.tending, rng);
      summary = `${r.name} is ${patch.activity}.`;
    } else {
      patch.energy = Math.max(0, r.energy - 5);
      patch.activity = pick(cfg.studying, rng);
      patch.mood = "attentive";
      summary = `${r.name} is ${patch.activity}.`;
    }

    // Goal progress: the action that matches the goal's kind advances it.
    let progress = r.goal_progress;
    if (action === r.goal_kind) {
      progress = r.goal_progress + 1;
      patch.goal_progress = progress;
    }

    if (progress >= r.goal_target && r.goal_target > 0) {
      const pool = NEXT_GOALS[world];
      const next = pool[Math.floor(rng() * pool.length) % pool.length];
      patch.goal = next.text;
      patch.goal_kind = next.kind;
      patch.goal_target = next.target;
      patch.goal_progress = 0;
      patch.mood = "satisfied";
      await appendEvent(world, "goal", `${r.name} finishes: ${r.goal}`, { resident: r.name }, tick);
      eventCount++;
    }

    await sbWrite(`world_residents?id=eq.${r.id}`, "PATCH", patch);

    if (summary) {
      await appendEvent(world, kind, summary, { resident: r.name, action }, tick);
      eventCount++;
    }
    acted.push(r.name);
  }

  await sbWrite(`world_resident_state?world=eq.${world}`, "PATCH", {
    tick,
    updated_at: new Date().toISOString(),
  });

  return { world, initialized: true, tick, acted, events: eventCount };
}

/** Advance every resident world. Used by the cron route. */
export async function runAllResidentTicks(): Promise<WorldTickResult[]> {
  if (!supabaseReady()) return RESIDENT_WORLDS.map((w) => ({ world: w, initialized: false }));
  const out: WorldTickResult[] = [];
  for (const w of RESIDENT_WORLDS) {
    out.push(await runWorldResidentTick(w));
  }
  return out;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
