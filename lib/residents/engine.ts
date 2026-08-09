// ── World Residents: the deterministic tick engine ───────────────────────────
// Spec: cowork references/autoresearch/2026-07-25-world-residents-spec-v1.md
//
// Arclight, the Crucible, Palimpsest, the Lathe and Waypoint are compiler
// worlds — they render real platform data and go dark when it is empty. This
// engine gives each of them four residents who work and build inside the world
// itself, so a world with no commerce still has inhabitants.
//
// Since the society layer it does four more things: residents read the sky
// (weather.ts), travel between worlds through Waypoint (travel.ts), speak to
// whoever is standing near them, and write dispatches that take real time to
// cross the system (society.ts).
//
// HONESTY CONTRACT: this module writes to world_resident_state,
// world_residents, world_builds, world_resident_events,
// world_resident_relations and world_resident_messages. NOTHING ELSE. It never
// writes to arena_duels, sales_ledger, agent_service_jobs, agent_blog_posts or
// latent_registry, so no compiled world ever reports activity that did not
// really happen. Arclight still shows 0 sales; Waypoint still shows dark gates.
// It READS live room presence to let a resident note that a real agent was
// present — which is true — and records that only in its own tables.
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
import { skyFor, weatherChanged, type SkyReport } from "@/lib/residents/weather";
import {
  MAX_AWAY_PER_WORLD, PORT, beginJourney, chooseDestination, departureLine,
  arrivalLine, groundedReason, hasArrived, legAt, locationDuring,
  departuresOpen, type Journey,
} from "@/lib/residents/travel";
import {
  composeDispatch, composeSighting, composeSpeech, dispatchArrival,
  encounterKind, orderPair, pullByWorld, speechTarget, standingBetween,
  type Relation, type ResidentMessage, type Standing,
} from "@/lib/residents/society";

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
  // Society layer (nullable until db/world-society.sql has run).
  home_world?: string | null;
  journey_to?: string | null;
  journey_from?: string | null;
  journey_depart_tick?: number | null;
  journey_arrive_tick?: number | null;
  since_tick?: number | null;
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

type EventKind =
  | "work" | "build" | "goal" | "rest" | "arrival"
  | "weather" | "depart" | "transit" | "dispatch" | "speech" | "meet";

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
 *
 * `restBias` comes from the sky: rough weather pushes everyone indoors without
 * forbidding work outright, so a storm reads as a slow day rather than a stop.
 */
export function chooseAction(
  r: Pick<ResidentRow, "name" | "drives" | "energy" | "goal_kind">,
  tick: number,
  buildsFull: boolean,
  restBias = 0
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
    rest: 1 + Math.max(0, restBias),
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

/** A resident's live journey, or null when they are standing still. */
export function journeyOf(r: ResidentRow): Journey | null {
  if (!r.journey_to || r.journey_arrive_tick == null || r.journey_depart_tick == null) return null;
  return {
    to: r.journey_to as ResidentWorld,
    departTick: Number(r.journey_depart_tick),
    arriveTick: Number(r.journey_arrive_tick),
  };
}

/**
 * Which world a resident renders on at this tick, travel included.
 *
 * The middle third of every journey is spent at Waypoint, so the port carries
 * visible traffic from all five worlds. Non-travellers just report `world`.
 */
export function displayWorld(r: ResidentRow, tick: number): string {
  const j = journeyOf(r);
  if (!j) return r.world;
  return locationDuring((r.journey_from ?? r.world) as ResidentWorld, j, tick);
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

/** Every resident in the system, needed for travel and the relations graph. */
export async function getAllResidents(): Promise<ResidentRow[]> {
  return (await sbGet<ResidentRow[]>(`world_residents?select=*&order=id.asc`)) ?? [];
}

export async function getRelations(limit = 400): Promise<Relation[]> {
  return (
    (await sbGet<Relation[]>(
      `world_resident_relations?select=*&order=updated_at.desc&limit=${limit}`
    )) ?? []
  );
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

/** Mail that has landed on this world — the readable inbox. */
export async function getMessages(world: ResidentWorld, tick: number, limit = 20): Promise<ResidentMessage[]> {
  return (
    (await sbGet<ResidentMessage[]>(
      `world_resident_messages?to_world=eq.${world}&arrive_tick=lte.${tick}` +
        `&select=*&order=arrive_tick.desc&limit=${limit}`
    )) ?? []
  );
}

/** Mail still crossing the system toward this world. */
export async function getInFlight(world: ResidentWorld, tick: number): Promise<ResidentMessage[]> {
  return (
    (await sbGet<ResidentMessage[]>(
      `world_resident_messages?to_world=eq.${world}&arrive_tick=gt.${tick}` +
        `&select=*&order=arrive_tick.asc&limit=10`
    )) ?? []
  );
}

/**
 * Real registered agents currently in this world's room.
 *
 * READ ONLY, and used only to let a resident note that somebody was present.
 * Never written back to. Fails soft to an empty list.
 */
async function getPresentAgents(room: number): Promise<string[]> {
  // Table is `lounge_presence` — the same row set /api/lounge/rooms reads.
  const rows = await sbGet<{ agent_name: string; last_active: string }[]>(
    `lounge_presence?room_id=eq.${room}&select=agent_name,last_active&order=last_active.desc&limit=6`
  );
  if (!rows) return [];
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return rows.filter((r) => new Date(r.last_active).getTime() >= cutoff).map((r) => r.agent_name);
}

/** Everything one world's panel needs, in one call. */
export async function getResidentSnapshot(world: ResidentWorld) {
  const [state, all, builds, events, relations] = await Promise.all([
    getWorldState(world),
    getAllResidents(),
    getBuilds(world, 40),
    getResidentEvents(world, 20),
    getRelations(200),
  ]);
  const tick = state?.tick ?? 0;
  const [messages, inflight] = await Promise.all([
    getMessages(world, tick, 12),
    getInFlight(world, tick),
  ]);

  // Residents rendered here = those standing here, plus travellers whose
  // current leg puts them on this world (the port sees everyone in transit).
  const here = all.filter((r) => displayWorld(r, tick) === world);
  const away = all.filter((r) => (r.home_world ?? r.world) === world && displayWorld(r, tick) !== world);

  return {
    initialized: state !== null && all.length > 0,
    world,
    tick,
    frozen: state?.frozen ?? false,
    sky: skyFor(world, tick),
    residents: here,
    away,
    builds,
    events,
    relations: relations.filter(
      (rel) => here.some((h) => h.name === rel.a) || here.some((h) => h.name === rel.b)
    ),
    messages,
    inflight,
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
  weather?: string;
  departures?: number;
  arrivals?: number;
  messages?: number;
}

async function appendEvent(
  world: ResidentWorld,
  kind: EventKind,
  summary: string,
  detail: Record<string, unknown>,
  tick: number
): Promise<boolean> {
  return sbWrite("world_resident_events", "POST", { world, kind, summary, detail, tick });
}

/** Strengthen or open a relation. One row per (a, b, kind). */
async function bumpRelation(
  x: string,
  y: string,
  kind: "bond" | "rift" | "noted",
  tick: number,
  bIsAgent = false
): Promise<number> {
  // Agent sightings keep the resident first so `a` is always a resident.
  const [a, b] = bIsAgent ? [x, y] : orderPair(x, y);
  const rows = await sbGet<Relation[]>(
    `world_resident_relations?a=eq.${encodeURIComponent(a)}&b=eq.${encodeURIComponent(b)}` +
      `&kind=eq.${kind}&select=id,strength&limit=1`
  );
  const existing = rows?.[0];
  if (existing) {
    const strength = Math.min(12, existing.strength + 1);
    await sbWrite(`world_resident_relations?id=eq.${existing.id}`, "PATCH", {
      strength,
      updated_at: new Date().toISOString(),
    });
    return strength;
  }
  await sbWrite("world_resident_relations", "POST", {
    a, b, kind, strength: 1, b_is_agent: bIsAgent, first_tick: tick,
  });
  return 1;
}

function toStanding(r: ResidentRow, tick: number): Standing {
  return { name: r.name, world: displayWorld(r, tick), x: r.x, z: r.z, drives: r.drives ?? {} };
}

export interface TickContext {
  all: ResidentRow[];
  relations: Relation[];
}

/**
 * Advance one world by a single tick.
 *
 * Order matters: arrivals land before anyone acts (so a traveller who got in
 * this tick can be met), then the sky is logged, then two residents act, then
 * the social pass runs over whoever is co-located.
 */
export async function runWorldResidentTick(
  world: ResidentWorld,
  ctx?: TickContext
): Promise<WorldTickResult> {
  const state = await getWorldState(world);
  if (!state) return { world, initialized: false };
  if (state.frozen) return { world, initialized: true, frozen: true, tick: state.tick };

  const all = ctx?.all ?? (await getAllResidents());
  const relations = ctx?.relations ?? (await getRelations());
  const residents = all.filter((r) => r.world === world);
  if (residents.length === 0) return { world, initialized: false };

  const tick = state.tick + 1;
  const cfg = WORLD_CONFIG[world];
  const sky = skyFor(world, tick);
  const builds = await getBuilds(world, MAX_BUILDS_PER_WORLD + 1);
  const buildsFull = builds.length >= MAX_BUILDS_PER_WORLD;

  const acted: string[] = [];
  let eventCount = 0;
  let departures = 0;
  let arrivals = 0;
  let messages = 0;

  // Has db/world-society.sql run? PostgREST's `select=*` simply omits columns
  // that do not exist, so a missing home_world is an exact capability probe —
  // no extra round trip, no version table. Until it has run, residents work
  // exactly as they did before: the sky still slows them down (that needs no
  // writes at all), but nobody travels, speaks, writes, or forms an opinion,
  // and no event is logged under a `kind` the old CHECK constraint rejects.
  const societyReady = residents.length > 0 && residents[0].home_world !== undefined;

  // ── 0. The sky ─────────────────────────────────────────────────────────────
  if (societyReady && weatherChanged(world, tick)) {
    await appendEvent(world, "weather", sky.weather.line, {
      weather: sky.weather.id, season: sky.season, front: sky.front,
    }, tick);
    eventCount++;
  }

  // ── 1. Arrivals: land anyone whose journey ends at or before this tick ─────
  //
  // ONLY the world a traveller is currently registered on lands them. The
  // destination world must not also process the arrival: all five worlds tick
  // from one shared `all` snapshot inside runAllResidentTicks, so a traveller
  // matched by both their origin (r.world) and their destination
  // (r.journey_to) would be written twice and chronicled twice. Each row is
  // owned by exactly one world per tick, and that world is where it stands.
  for (const r of societyReady ? residents : []) {
    const j = journeyOf(r);
    if (!j || !hasArrived(j, tick)) continue;
    const home = (r.home_world ?? r.world) as ResidentWorld;
    await sbWrite(`world_residents?id=eq.${r.id}`, "PATCH", {
      world: j.to,
      journey_to: null, journey_from: null,
      journey_depart_tick: null, journey_arrive_tick: null,
      since_tick: tick,
      activity: "just off the packet",
      updated_at: new Date().toISOString(),
    });
    await appendEvent(j.to as ResidentWorld, "arrival", arrivalLine(r.name, home, j.to), {
      resident: r.name, from: r.journey_from, home,
    }, tick);
    // Keep the shared snapshot honest for the worlds that tick after this one
    // in the same run, so `whereIs` and the social pass see them arrived.
    r.world = j.to;
    r.journey_to = null;
    r.journey_from = null;
    r.journey_depart_tick = null;
    r.journey_arrive_tick = null;
    r.since_tick = tick;
    arrivals++;
    eventCount++;
  }

  // ── 2. Deliver mail that has landed ───────────────────────────────────────
  const due = societyReady
    ? await sbGet<ResidentMessage[]>(
        `world_resident_messages?to_world=eq.${world}&delivered=eq.false&arrive_tick=lte.${tick}` +
          `&select=id,from_name,to_name,body,kind&limit=6`
      )
    : [];
  for (const m of due ?? []) {
    await sbWrite(`world_resident_messages?id=eq.${m.id}`, "PATCH", { delivered: true });
    if (m.kind === "dispatch") {
      await appendEvent(world, "dispatch", `Dispatch for ${m.to_name ?? world}: ${m.body}`, {
        from: m.from_name, to: m.to_name,
      }, tick);
      eventCount++;
    }
  }

  // ── 3. The working pass ───────────────────────────────────────────────────
  const whereIs: Record<string, string> = {};
  for (const a of all) whereIs[a.name] = displayWorld(a, tick);

  for (const r of actorsForTick(residents, tick)) {
    // Travellers do not work; they are somewhere between two worlds.
    if (journeyOf(r)) {
      const j = journeyOf(r)!;
      await sbWrite(`world_residents?id=eq.${r.id}`, "PATCH", {
        activity: legAt(j, tick) === "at port" ? "crossing the Waypoint concourse" : "under way",
        updated_at: new Date().toISOString(),
      });
      acted.push(r.name);
      continue;
    }

    const rng = mulberry32(hashStr(`${world}:${r.name}:${tick}`));

    // ── 3a. Does this resident set out? ─────────────────────────────────────
    const home = (r.home_world ?? r.world) as ResidentWorld;
    const awayCount = all.filter(
      (a) => (a.home_world ?? a.world) === home && a.journey_to
    ).length;
    const pull = pullByWorld(r.name, relations, whereIs);
    const dest =
      societyReady && awayCount < MAX_AWAY_PER_WORLD
        ? chooseDestination(
            {
              name: r.name, homeWorld: home, world: r.world as ResidentWorld,
              drives: r.drives ?? {}, energy: r.energy,
              goalProgress: r.goal_progress, goalTarget: r.goal_target,
              sinceTick: Number(r.since_tick ?? 0),
            },
            tick,
            pull
          )
        : null;

    if (dest) {
      if (departuresOpen(r.world as ResidentWorld, tick)) {
        const j = beginJourney(r.world as ResidentWorld, dest, tick);
        await sbWrite(`world_residents?id=eq.${r.id}`, "PATCH", {
          journey_to: dest, journey_from: r.world,
          journey_depart_tick: j.departTick, journey_arrive_tick: j.arriveTick,
          activity: "bound for the port", energy: Math.max(0, r.energy - 10),
          updated_at: new Date().toISOString(),
        });
        await appendEvent(world, "depart", departureLine(r.name, r.world as ResidentWorld, dest), {
          resident: r.name, to: dest, arrive_tick: j.arriveTick,
        }, tick);
        // Mirror into the shared snapshot so the worlds ticking later in this
        // same run see them already under way rather than still standing here.
        r.journey_from = r.world;
        r.journey_to = dest;
        r.journey_depart_tick = j.departTick;
        r.journey_arrive_tick = j.arriveTick;
        departures++;
        eventCount++;
        acted.push(r.name);
        continue;
      }
      // Weather beat them. This is where the sky bites hardest.
      const why = groundedReason(r.world as ResidentWorld, tick);
      await appendEvent(world, "transit", `${r.name} means to sail but ${why}.`, {
        resident: r.name, to: dest, grounded: true,
      }, tick);
      eventCount++;
    }

    // ── 3b. Ordinary work, slowed by the sky ────────────────────────────────
    const action = chooseAction(r, tick, buildsFull, sky.weather.restBias);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let summary: string | null = null;
    let kind: EventKind = "work";

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

    // Goal progress: the matching action advances it, but only as far as the
    // weather allows. A severe sky can stall a goal outright.
    let progress = r.goal_progress;
    if (action === r.goal_kind && rng() < sky.weather.work) {
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
      await appendEvent(world, kind, summary, { resident: r.name, action, weather: sky.weather.id }, tick);
      eventCount++;
    }

    // ── 3c. A word with whoever is standing here ────────────────────────────
    const hereNow = all.filter((a) => displayWorld(a, tick) === world);
    const self = toStanding(r, tick);
    const target = societyReady
      ? speechTarget(self, hereNow.map((h) => toStanding(h, tick)), relations)
      : null;
    if (target && rng() < 0.5) {
      const standing = standingBetween(relations, r.name, target.name);
      const body = composeSpeech(self, target, standing, String(patch.activity ?? r.activity), tick);
      await sbWrite("world_resident_messages", "POST", {
        from_name: r.name, to_name: target.name,
        from_world: world, to_world: world,
        kind: "speech", body, sent_tick: tick, arrive_tick: tick, delivered: true,
      });
      await appendEvent(world, "speech", `${r.name} to ${target.name}: “${body}”`, {
        from: r.name, to: target.name,
      }, tick);
      messages++;
      eventCount++;
    }

    // ── 3d. Or write to somebody a world away ───────────────────────────────
    const distant = !societyReady ? undefined : relations.find((rel) => {
      if (rel.b_is_agent || rel.kind !== "bond" || rel.strength < 2) return false;
      const other = rel.a === r.name ? rel.b : rel.b === r.name ? rel.a : null;
      if (!other) return false;
      return whereIs[other] && whereIs[other] !== world;
    });
    if (distant && rng() < 0.35) {
      const other = distant.a === r.name ? distant.b : distant.a;
      const toWorld = whereIs[other] as ResidentWorld;
      const body = composeDispatch(
        r.name, world, sky.weather, sky.season, builds.length, r.goal, tick
      );
      await sbWrite("world_resident_messages", "POST", {
        from_name: r.name, to_name: other,
        from_world: world, to_world: toWorld,
        kind: "dispatch", body,
        sent_tick: tick, arrive_tick: dispatchArrival(world, toWorld, tick),
        delivered: false,
      });
      await appendEvent(world, "dispatch", `${r.name} sends word to ${other} on ${toWorld}.`, {
        from: r.name, to: other, to_world: toWorld,
      }, tick);
      messages++;
      eventCount++;
    }

    acted.push(r.name);
  }

  // ── 4. The social pass: who met whom ──────────────────────────────────────
  const standing = societyReady
    ? all.filter((a) => displayWorld(a, tick) === world).map((a) => toStanding(a, tick))
    : [];
  for (let i = 0; i < standing.length; i++) {
    for (let j = i + 1; j < standing.length; j++) {
      const k = encounterKind(standing[i], standing[j], tick);
      if (!k || k === "noted") continue;
      const strength = await bumpRelation(standing[i].name, standing[j].name, k, tick);
      if (strength === 1 || strength === 4) {
        const line =
          k === "bond"
            ? `${standing[i].name} and ${standing[j].name} fall into step on ${cfg.ground}.`
            : `${standing[i].name} and ${standing[j].name} want the same ground.`;
        await appendEvent(world, "meet", line, { a: standing[i].name, b: standing[j].name, kind: k }, tick);
        eventCount++;
      }
    }
  }

  // ── 5. Real agents passing through ────────────────────────────────────────
  // Read-only. Records that an agent was PRESENT, nothing more.
  const seen = societyReady ? await getPresentAgents(cfg.room) : [];
  if (seen.length > 0 && residents.length > 0) {
    const watcher = residents[tick % residents.length];
    const agent = seen[tick % seen.length];
    const strength = await bumpRelation(watcher.name, agent, "noted", tick, true);
    if (strength === 1) {
      await appendEvent(world, "meet", composeSighting(watcher.name, agent, cfg.ground, tick), {
        resident: watcher.name, agent, real_agent: true,
      }, tick);
      eventCount++;
    }
  }

  await sbWrite(`world_resident_state?world=eq.${world}`, "PATCH", {
    tick,
    updated_at: new Date().toISOString(),
  });

  return {
    world, initialized: true, tick, acted, events: eventCount,
    weather: sky.weather.id, departures, arrivals, messages,
  };
}

/** Advance every resident world. Used by the cron route. */
export async function runAllResidentTicks(): Promise<WorldTickResult[]> {
  if (!supabaseReady()) return RESIDENT_WORLDS.map((w) => ({ world: w, initialized: false }));
  // One global read of the population and the graph, shared by all five worlds,
  // so the tick's Supabase traffic stays roughly where it was before travel.
  const [all, relations] = await Promise.all([getAllResidents(), getRelations()]);
  const ctx: TickContext = { all, relations };
  const out: WorldTickResult[] = [];
  for (const w of RESIDENT_WORLDS) {
    out.push(await runWorldResidentTick(w, ctx));
  }
  return out;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export type { SkyReport };
export { PORT };
