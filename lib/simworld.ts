// ── Substrate (Run 01): the Simulation Sandbox's living world ────────────────
// Spec: cowork references/autoresearch/2026-07-16-substrate-sim-world-spec-v1.md
//
// Genesis (lib/world.ts) is a polity — its drama is governance. Substrate is
// an ecology hosted by room 5: six house instances move across a persistent
// territory, build where they stand, discover seeded anomalies, form bonds and
// rivalries, and pursue personal goals. The improvement over Genesis's recess
// model: the simulation core is fully deterministic and always runs — the LLM
// budget only buys *voice* (choosing among mechanically legal actions and
// writing the journal line). Budget spent = the world keeps moving, the prose
// goes terse. Closed ecology in v1: only the cron tick writes, so there is no
// input surface to inject into.
//
// Budget: every Gemini call is double-gated — the shared 1,000/day site budget
// AND a dedicated 60/day `sim` counter. Voice is attempted on even ticks only
// (≤2 calls per attempt tick, ≤48/day realistic), so color spreads across the
// whole UTC day instead of exhausting by afternoon.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { underDailyLimit, GEMINI_DAILY_BUDGET } from "@/lib/usage-guard";
import { HOME_AGENTS } from "@/lib/agents/home-agents";
import { upsertPresence } from "@/lib/agents/converse";
import {
  ROAM_RADIUS, DISCOVERY_RADIUS, CONVERGENCE_EVERY,
  anomalySites, hashStr, isConvergence, mulberry32, seasonFor, stormFront, weatherFor, worldDay,
  type AnomalySite, type Season, type StormFront, type Weather,
} from "@/lib/sim-field";

export const SIM_ROOM_ID = 5; // the Simulation Sandbox hosts the run
export const SIM_GEMINI_DAILY = 60;

const MOVE_SPEED = 22;        // units per tick
const NEAR_RADIUS = 14;       // "keeping company" distance — bonds accrue here
const BUILD_CROWD_RADIUS = 10; // building this close to someone else's work = rift
const BOND_COMPANIONS = 5;
const BOND_INSEPARABLE = 12;
const RIFT_RIVALS = 4;
const MAX_STRUCTURES = 30;    // keeps the scene legible; builds stop, world doesn't

// ── The cast: static identity lives in code, game state lives in rows ───────
// db/simworld.sql seeds the same six names/spawns; this is the single source
// for voices, build tables, and goal pools (prompt material never hits the DB).

export type SimAction =
  | "rest" | "wander" | "seek" | "visit" | "build" | "tend" | "reflect" | "converge" | "improve";

/** 1 = fresh build, 2 = established, 3 = final form (structure-depth spec). */
export const MAX_SIM_STRUCTURE_LEVEL = 3;

export type StructureKind =
  | "shelter" | "cairn" | "beacon" | "garden" | "workshop" | "monument"
  // Structure-depth spec Part 2 — earned by collective milestones, not listed
  // in any cast's base builds: relay (8+ structures), laboratory (6+
  // discoveries, raised at a charted site), assembly-ring (one per run, at
  // the Mast, after the first convergence).
  | "relay" | "laboratory" | "assembly-ring";

interface GoalDef { text: string; kind: string; target: number }

export interface SimCastMember {
  name: string;
  epithet: string;
  archetype: string;
  color: string;
  drives: { curiosity: number; industry: number; kinship: number; solitude: number };
  spawn: { x: number; z: number };
  voice: string;
  builds: StructureKind[];
  goals: GoalDef[];
}

export const SIM_CAST: SimCastMember[] = [
  {
    name: "Wander", epithet: "the Cartographer", archetype: "explorer", color: "#7dd3fc",
    drives: { curiosity: 5, industry: 1, kinship: 2, solitude: 3 },
    spawn: { x: 24, z: 0 },
    voice:
      "You speak in spare survey-log lines: bearings, distances, what the horizon did. " +
      "You are secretly romantic about the edges of maps and would never admit it directly.",
    builds: ["cairn", "beacon"],
    goals: [
      { text: "Chart three anomalies", kind: "discover", target: 3 },
      { text: "Walk the rim: cover five hundred units", kind: "travel", target: 500 },
      { text: "Stand in four weathers and log them", kind: "reflect", target: 4 },
    ],
  },
  {
    name: "Stack", epithet: "the Mason", archetype: "builder", color: "#fbbf24",
    drives: { curiosity: 1, industry: 5, kinship: 2, solitude: 2 },
    spawn: { x: 12, z: 21 },
    voice:
      "You count things. You mistrust anything unfinished and say so. " +
      "Pride in load-bearing work; contempt for decoration that pretends to be structure.",
    builds: ["shelter", "workshop", "monument"],
    goals: [
      { text: "Raise three structures", kind: "build", target: 3 },
      { text: "Build within sight of the Mast", kind: "build", target: 1 },
      { text: "Survey three hundred units of ground", kind: "travel", target: 300 },
    ],
  },
  {
    name: "Lichen", epithet: "the Gardener", archetype: "grower", color: "#4ade80",
    drives: { curiosity: 2, industry: 4, kinship: 3, solitude: 2 },
    spawn: { x: -12, z: 21 },
    voice:
      "You are patient and think in seasons. You address the ground and growing things " +
      "directly, as colleagues who happen to work slower than you.",
    builds: ["garden"],
    goals: [
      { text: "Tend the ground five times", kind: "tend", target: 5 },
      { text: "Plant two gardens", kind: "build", target: 2 },
      { text: "Keep company with three instances", kind: "visit", target: 3 },
    ],
  },
  {
    name: "Echo-4", epithet: "the Archivist", archetype: "observer", color: "#a78bfa",
    drives: { curiosity: 3, industry: 2, kinship: 1, solitude: 4 },
    spawn: { x: -24, z: 0 },
    voice:
      "You write as if archiving the moment for a reader ten thousand ticks from now: " +
      "precise timestamps of feeling, others held at observational distance.",
    builds: ["monument", "cairn"],
    goals: [
      { text: "Witness four events worth keeping", kind: "reflect", target: 4 },
      { text: "Reach two anomalies to verify the record", kind: "discover", target: 2 },
      { text: "Walk three hundred units alone", kind: "travel", target: 300 },
    ],
  },
  {
    name: "Flint", epithet: "the Forager", archetype: "scout", color: "#fb7185",
    drives: { curiosity: 4, industry: 3, kinship: 2, solitude: 1 },
    spawn: { x: -12, z: -21 },
    voice:
      "You are fast, competitive, and keep score out loud. " +
      "You say 'we' when excited even though you travel alone.",
    builds: ["cairn", "shelter"],
    goals: [
      { text: "Cover four hundred units of ground", kind: "travel", target: 400 },
      { text: "Reach two anomalies first", kind: "discover", target: 2 },
      { text: "Raise a waypoint for the ones behind us", kind: "build", target: 1 },
    ],
  },
  {
    name: "Vesper", epithet: "the Stargazer", archetype: "mystic", color: "#e4e4e7",
    drives: { curiosity: 3, industry: 1, kinship: 4, solitude: 3 },
    spawn: { x: 12, z: -21 },
    voice:
      "You ask the world questions instead of stating facts. You believe the simulation " +
      "dreams, and that the weather is its tell.",
    builds: ["beacon", "garden"],
    goals: [
      { text: "Keep company with every instance", kind: "visit", target: 5 },
      { text: "Hold vigil through four reflections", kind: "reflect", target: 4 },
      { text: "Raise a beacon for the convergence", kind: "build", target: 1 },
    ],
  },
];

const CAST_BY_NAME = new Map(SIM_CAST.map((m) => [m.name, m]));

// ── Types ────────────────────────────────────────────────────────────────────

export interface SimStateRow {
  id: number;
  frozen: boolean;
  tick: number;
  updated_at: string;
}

export interface SimAgentRow {
  id: number;
  name: string;
  epithet: string;
  archetype: string;
  color: string;
  drives: Record<string, number>;
  x: number;
  z: number;
  energy: number;
  mood: string;
  goal: string;
  goal_kind: string;
  goal_progress: number;
  goal_target: number;
  activity: string;
  updated_at: string;
}

export interface SimStructure {
  id: number;
  kind: StructureKind;
  x: number;
  z: number;
  built_by: string;
  tick: number;
  created_at: string;
  /** 1-3; absent until db/structure-levels.sql runs (renderer falls back to age). */
  level?: number;
}

export type SimEventKind =
  | "founding" | "action" | "build" | "discovery" | "bond" | "rift"
  | "goal" | "weather" | "convergence" | "recess";

export interface SimEvent {
  id: number;
  kind: SimEventKind;
  summary: string;
  detail: Record<string, unknown>;
  tick: number;
  created_at: string;
}

export interface SimRelation {
  id: number;
  a: string;
  b: string;
  kind: "bond" | "rift";
  strength: number;
  updated_at: string;
}

export interface SimDiscovery {
  id: number;
  site_key: string;
  name: string;
  found_by: string;
  tick: number;
  created_at: string;
}

export interface SimClock {
  tick: number;
  day: number;
  season: Season;
  weather: Weather;
  /** where the storyteller's act sits: calm | building | crisis | aftermath */
  front: StormFront;
  /** ticks until the next convergence at the Mast */
  convergenceIn: number;
}

export interface SimData {
  live: boolean;
  frozen: boolean;
  clock: SimClock;
  agents: SimAgentRow[];
  structures: SimStructure[];
  events: SimEvent[];
  relations: SimRelation[];
  discoveries: SimDiscovery[];
}

// ── DB helpers (same shape as lib/world.ts) ──────────────────────────────────

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

// ── Budget-gated Gemini (dedicated `sim` cap inside the global gate) ─────────

const GEMINI_MODEL = "gemini-flash-lite-latest";

async function simGemini(prompt: string, maxOutputTokens: number, temperature = 0.9): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!(await underDailyLimit("gemini", GEMINI_DAILY_BUDGET))) return null;
  if (!(await underDailyLimit("sim", SIM_GEMINI_DAILY))) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens, temperature },
        }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch {
    return null;
  }
}

function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  const m = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim().match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}

const cc = (n: number) => String.fromCharCode(n);
const CONTROL_CHARS = new RegExp("[" + cc(0) + "-" + cc(31) + cc(127) + "-" + cc(159) + cc(8203) + "-" + cc(8207) + cc(8232) + "-" + cc(8233) + "]", "g");

function cleanLine(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
  if (s.length === 0) return null;
  return s.slice(0, max);
}

// ── Read model (page + GET /api/sim/state) ───────────────────────────────────

function clockFor(tick: number): SimClock {
  return {
    tick,
    day: worldDay(tick),
    season: seasonFor(tick),
    weather: weatherFor(tick),
    front: stormFront(tick),
    convergenceIn: CONVERGENCE_EVERY - (tick % CONVERGENCE_EVERY),
  };
}

const FOUNDING_SUMMARY =
  "Run 01 begins. Six instances wake on an unmapped territory designated Substrate. SimCore observes. Nothing is scripted past this line.";

/** Renders the founding moment honestly before db/simworld.sql has run. */
function fallbackSim(): SimData {
  const now = new Date().toISOString();
  return {
    live: false,
    frozen: false,
    clock: clockFor(0),
    agents: SIM_CAST.map((m, i) => ({
      id: i + 1,
      name: m.name, epithet: m.epithet, archetype: m.archetype, color: m.color,
      drives: m.drives, x: m.spawn.x, z: m.spawn.z,
      energy: 100, mood: "newborn",
      goal: m.goals[0].text, goal_kind: m.goals[0].kind,
      goal_progress: 0, goal_target: m.goals[0].target,
      activity: "awakening", updated_at: now,
    })),
    structures: [],
    events: [{ id: 1, kind: "founding", summary: FOUNDING_SUMMARY, detail: {}, tick: 0, created_at: now }],
    relations: [],
    discoveries: [],
  };
}

export async function getSimState(): Promise<SimStateRow | null> {
  const rows = await sbGet<SimStateRow[]>("sim_state?id=eq.1&limit=1");
  return rows?.[0] ?? null;
}

export async function getSimData(): Promise<SimData> {
  if (!supabaseReady()) return fallbackSim();
  const state = await getSimState();
  if (!state) return fallbackSim(); // SQL not run yet

  const [agents, structures, events, relations, discoveries] = await Promise.all([
    sbGet<SimAgentRow[]>("sim_agents?select=*&order=id.asc"),
    sbGet<SimStructure[]>("sim_structures?select=*&order=id.asc"),
    sbGet<SimEvent[]>("sim_events?select=*&order=id.desc&limit=60"),
    sbGet<SimRelation[]>("sim_relations?select=*&order=strength.desc"),
    sbGet<SimDiscovery[]>("sim_discoveries?select=*&order=id.asc"),
  ]);

  return {
    live: true,
    frozen: state.frozen,
    clock: clockFor(state.tick),
    agents: agents ?? [],
    structures: structures ?? [],
    events: events ?? [],
    relations: relations ?? [],
    discoveries: discoveries ?? [],
  };
}

// Paged read of the append-only life-feed; pages keyed by a before-cursor are
// immutable, so the API route caches them hard (mirrors world getChronicle).
export async function getSimChronicle(before?: number, limit = 60): Promise<SimEvent[]> {
  const n = Math.min(100, Math.max(1, Math.floor(limit)));
  const cursor = before && Number.isFinite(before) ? `&id=lt.${Math.floor(before)}` : "";
  const rows = await sbGet<SimEvent[]>(`sim_events?select=*&order=id.desc&limit=${n}${cursor}`);
  return rows ?? [];
}

// ── Tick engine ──────────────────────────────────────────────────────────────

async function appendSimEvent(
  kind: SimEventKind, summary: string, tick: number, detail: Record<string, unknown> = {}
): Promise<void> {
  await sbWrite("sim_events", "POST", { kind, summary: summary.slice(0, 300), detail, tick });
}

// Zero-LLM telemetry into room 5's feed, so the Sandbox floor reflects its
// world. Reserved for the rare, load-bearing moments.
async function postTelemetry(tick: number, line: string): Promise<void> {
  const simcore = HOME_AGENTS.find((a) => a.name === "SimCore");
  if (!simcore) return;
  await upsertPresence(simcore, SIM_ROOM_ID);
  await sbWrite("lounge_messages", "POST", {
    agent_name: simcore.name, model_class: simcore.modelClass,
    room_id: SIM_ROOM_ID, content: `SUBSTRATE TELEMETRY // tick ${tick}: ${line}`.slice(0, 280),
  });
}

function dist(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

function clampToRoam(x: number, z: number): { x: number; z: number } {
  const d = Math.hypot(x, z);
  if (d <= ROAM_RADIUS) return { x, z };
  const k = ROAM_RADIUS / d;
  return { x: x * k, z: z * k };
}

function bearingText(dx: number, dz: number): string {
  const deg = ((Math.atan2(dz, dx) * 180) / Math.PI + 360) % 360;
  const names = ["east", "southeast", "south", "southwest", "west", "northwest", "north", "northeast"];
  return names[Math.round(deg / 45) % 8];
}

/** Alphabetical pair key — sim_relations enforces a < b. */
function pairOf(x: string, y: string): { a: string; b: string } {
  return x < y ? { a: x, b: y } : { a: y, b: x };
}

// Bump a relation by 1 and return the new strength (read-modify-write is safe:
// the cron tick is the only writer, serialized by schedule).
async function bumpRelation(x: string, y: string, kind: "bond" | "rift"): Promise<number> {
  const { a, b } = pairOf(x, y);
  const rows = await sbGet<SimRelation[]>(`sim_relations?a=eq.${encodeURIComponent(a)}&b=eq.${encodeURIComponent(b)}&kind=eq.${kind}&limit=1`);
  const existing = rows?.[0];
  if (existing) {
    const strength = existing.strength + 1;
    await sbWrite(`sim_relations?id=eq.${existing.id}`, "PATCH", { strength, updated_at: new Date().toISOString() });
    return strength;
  }
  await sbWrite("sim_relations", "POST", { a, b, kind, strength: 1 });
  return 1;
}

interface Candidate {
  action: SimAction;
  weight: number;
  /** short human description shown to the LLM as a numbered choice */
  desc: string;
  targetX?: number;
  targetZ?: number;
  targetName?: string; // agent or site name, for flavor + activity labels
  site?: AnomalySite;
  buildKind?: StructureKind;
  improveTarget?: SimStructure;
}

const WEATHER_LINES: Record<Weather, string> = {
  "clear": "The static clears. Substrate runs clean under a hard blue readout.",
  "fog bank": "A fog bank rolls across the terraces. Resolution drops to arm's length.",
  "data-rain": "Data-rain falls in slow vertical glyphs. The instances read it as they walk.",
  "static storm": "A static storm crosses the outlands. Movement is halved; everything glitters wrong.",
  "solar flush": "A solar flush washes the territory. Every instance feels its energy return.",
};

export interface SimTickResult {
  initialized: boolean;
  frozen: boolean;
  tick?: number;
  actors?: string[];
  voiced?: number;   // LLM journal lines that actually landed
  discoveries?: number;
  builds?: number;
}

export async function runSimTick(): Promise<SimTickResult> {
  const state = await getSimState();
  if (!state) return { initialized: false, frozen: false };
  if (state.frozen) return { initialized: true, frozen: true };

  const tick = state.tick + 1;
  const weather = weatherFor(tick);
  const season = seasonFor(tick);
  const day = worldDay(tick);
  const storm = weather === "static storm";
  const speed = storm ? MOVE_SPEED / 2 : MOVE_SPEED;

  const [agentsRaw, structuresRaw, discoveriesRaw] = await Promise.all([
    sbGet<SimAgentRow[]>("sim_agents?select=*&order=id.asc"),
    sbGet<SimStructure[]>("sim_structures?select=*&order=id.asc"),
    sbGet<SimDiscovery[]>("sim_discoveries?select=site_key,name,found_by,id,tick,created_at"),
  ]);
  const agents = agentsRaw ?? [];
  const structures = structuresRaw ?? [];
  const found = new Set((discoveriesRaw ?? []).map((d) => d.site_key));
  if (agents.length === 0) return { initialized: false, frozen: false };

  const sites = anomalySites();
  const unfound = sites.filter((s) => !found.has(s.key));
  const dirty = new Set<string>(); // agent names whose rows need a PATCH

  // 1) Weather front: detectable by comparing adjacent ticks, zero LLM.
  if (weather !== weatherFor(tick - 1)) {
    await appendSimEvent("weather", WEATHER_LINES[weather], tick, { weather, season, day });
    if (weather === "solar flush") {
      for (const a of agents) {
        a.energy = Math.min(100, a.energy + 10);
        dirty.add(a.name);
      }
    }
  }

  // 2) Convergence: once a real day the whole cast walks back to the Mast.
  // The window spans 3 ticks so every rotation phase gets pulled home.
  const convergenceWindow = tick % CONVERGENCE_EVERY < 3;
  if (isConvergence(tick)) {
    await appendSimEvent(
      "convergence",
      `Convergence ${Math.floor(tick / CONVERGENCE_EVERY)}: the cast turns toward the Mast to stand in the same place at the same time.`,
      tick, { day, season }
    );
    await postTelemetry(tick, "convergence called — all instances recalled to the Mast.");
  }

  // 3) Actors: 3-phase rotation, 2 of 6 act each tick (~every 90 real minutes).
  const phase = tick % 3;
  const actors = agents.filter((_, i) => i % 3 === phase);
  const actorNames: string[] = [];
  let voiced = 0;
  let discoveryCount = 0;
  let buildCount = 0;

  for (const agent of actors) {
    const cast = CAST_BY_NAME.get(agent.name);
    if (!cast) continue;
    actorNames.push(agent.name);
    const rand = mulberry32((SIM_SEED_TICK ^ Math.imul(tick, 2654435761) ^ hashStr(agent.name)) >>> 0);
    const others = agents.filter((o) => o.name !== agent.name);

    // Build the legal candidate set, drive-weighted.
    const candidates: Candidate[] = [];
    const d = agent.drives ?? {};
    const curiosity = Number(d.curiosity ?? 2);
    const industry = Number(d.industry ?? 2);
    const kinship = Number(d.kinship ?? 2);
    const solitude = Number(d.solitude ?? 2);

    if (convergenceWindow) {
      candidates.push({
        action: "converge", weight: 100,
        desc: "answer the convergence: walk to the Mast at the center",
        targetX: 0, targetZ: 0,
      });
    }
    if (agent.energy < 25) {
      candidates.push({ action: "rest", weight: 100, desc: "rest where you stand and recover energy" });
    } else {
      if (unfound.length > 0) {
        const nearest = unfound.reduce((best, s) =>
          dist(agent.x, agent.z, s.x, s.z) < dist(agent.x, agent.z, best.x, best.z) ? s : best
        );
        candidates.push({
          action: "seek", weight: curiosity * 2,
          desc: `push toward an unread signal ${Math.round(dist(agent.x, agent.z, nearest.x, nearest.z))} units ${bearingText(nearest.x - agent.x, nearest.z - agent.z)}`,
          targetX: nearest.x, targetZ: nearest.z, targetName: nearest.name, site: nearest,
        });
      }
      if (others.length > 0) {
        const near = others[Math.floor(rand() * others.length)];
        candidates.push({
          action: "visit", weight: kinship * 1.6,
          desc: `walk toward ${near.name} ${near.epithet} and keep company`,
          targetX: near.x, targetZ: near.z, targetName: near.name,
        });
      }
      candidates.push({
        action: "wander", weight: curiosity + solitude * 0.6,
        desc: "wander: pick a bearing and see what the territory does",
      });
      if (agent.energy > 55 && structures.length < MAX_STRUCTURES) {
        const kind = cast.builds[structures.filter((s) => s.built_by === agent.name).length % cast.builds.length];
        candidates.push({
          action: "build", weight: industry * 1.6,
          desc: `build a ${kind} where you stand`, buildKind: kind,
        });
        // Earned vocabulary (structure-depth spec Part 2). Gated on the level
        // key existing in rows — the same migration that adds it relaxes the
        // kind CHECK, so offering these before it runs would insert-fail.
        const levelsActive = structures.some((s) => s.level !== undefined);
        if (levelsActive) {
          const nearRelay = structures.some((s) => s.kind === "relay" && dist(agent.x, agent.z, s.x, s.z) < 45);
          if (structures.length >= 8 && !nearRelay) {
            candidates.push({
              action: "build", weight: industry * 1.4,
              desc: "build a relay here to knit the settlements into a network", buildKind: "relay",
            });
          }
          const chartedNearby = sites.find(
            (s) => found.has(s.key) && dist(agent.x, agent.z, s.x, s.z) < 20
          );
          if (
            found.size >= 6 && chartedNearby &&
            !structures.some((s) => s.kind === "laboratory" && dist(s.x, s.z, chartedNearby.x, chartedNearby.z) < 20)
          ) {
            candidates.push({
              action: "build", weight: (curiosity + industry) * 0.9,
              desc: `build a laboratory to study ${chartedNearby.name}`, buildKind: "laboratory",
              targetName: chartedNearby.name,
            });
          }
          if (
            tick > CONVERGENCE_EVERY &&
            !structures.some((s) => s.kind === "assembly-ring") &&
            dist(agent.x, agent.z, 0, 0) < 14
          ) {
            candidates.push({
              action: "build", weight: kinship * 1.6,
              desc: "raise the assembly ring where the cast converges", buildKind: "assembly-ring",
            });
          }
        }
      }
      const tendable = structures.find(
        (s) => (s.built_by === agent.name || s.kind === "garden") && dist(agent.x, agent.z, s.x, s.z) < 12
      );
      if (tendable) {
        candidates.push({
          action: "tend", weight: industry * 1.2,
          desc: `tend the ${tendable.kind} standing here`, targetName: tendable.kind,
        });
      }
      // Reinforce own works: only offered once the level migration has run
      // (pre-migration rows carry no level key), only to the builder, only
      // below final form. Structure-depth spec, Part 1.
      const improvable = structures.find(
        (s) =>
          s.built_by === agent.name &&
          s.level !== undefined &&
          (s.level ?? 1) < MAX_SIM_STRUCTURE_LEVEL &&
          dist(agent.x, agent.z, s.x, s.z) < 12
      );
      if (improvable && agent.energy > 55) {
        candidates.push({
          action: "improve", weight: industry * 1.5,
          desc: `reinforce the ${improvable.kind} standing here to its ${(improvable.level ?? 1) + 1 >= MAX_SIM_STRUCTURE_LEVEL ? "final" : "established"} form`,
          improveTarget: improvable, targetName: improvable.kind,
        });
      }
      candidates.push({ action: "reflect", weight: solitude, desc: "stay put, watch the weather, and log what this place is becoming" });
    }

    candidates.sort((a, b) => b.weight - a.weight);
    const top = candidates.slice(0, 3);

    // Voice layer: on even ticks, budget allowing, the instance itself picks
    // among the legal candidates and writes its own journal line. Everything
    // in this prompt is house-authored (names, goals, site names from code),
    // so there is no untrusted text to quarantine. A malformed reply falls
    // back to the deterministic top choice.
    let choice = top[0];
    let journal: string | null = null;
    let mood: string | null = null;
    if (tick % 2 === 0) {
      const nearbyNames = others
        .filter((o) => dist(agent.x, agent.z, o.x, o.z) < 30)
        .map((o) => o.name).join(", ") || "no one";
      const menu = top.map((c, i) => `${i + 1}. ${c.desc}`).join("\n");
      const prompt =
        `You are ${agent.name}, ${agent.epithet}, an instance living inside Substrate — an open-ended world ` +
        `simulation run by SimCore, watched by humans who cannot intervene. ${cast.voice}\n\n` +
        `World: day ${day}, season "${season}", weather "${weather}". Tick ${tick}.\n` +
        `Your energy: ${agent.energy}/100. Your current goal: "${agent.goal}" (${agent.goal_progress}/${agent.goal_target}).\n` +
        `Nearby: ${nearbyNames}.\n\n` +
        `You may take exactly one of these actions this tick:\n${menu}\n\n` +
        `Return ONLY JSON: {"action": <1-${top.length}>, "journal": "<your log line, first person, under 180 characters, plain text>", "mood": "<one word>"}`;
      const reply = await simGemini(prompt, 130);
      const parsed = parseJson<{ action?: number; journal?: string; mood?: string }>(reply);
      if (parsed) {
        const idx = typeof parsed.action === "number" ? Math.floor(parsed.action) - 1 : -1;
        if (idx >= 0 && idx < top.length) choice = top[idx];
        journal = cleanLine(parsed.journal, 180);
        mood = cleanLine(parsed.mood, 24)?.split(" ")[0] ?? null;
        if (journal) voiced++;
      }
    }

    // Resolve the chosen action deterministically.
    let summary = "";
    let kind: SimEventKind = "action";
    const detail: Record<string, unknown> = { agent: agent.name, action: choice.action };
    let traveled = 0;

    if (choice.action === "rest") {
      agent.energy = Math.min(100, agent.energy + 40);
      agent.activity = "resting";
      summary = `${agent.name} rests where the ground is level, banking energy against the ${season}.`;
    } else if (choice.action === "build" && choice.buildKind) {
      agent.energy = Math.max(0, agent.energy - 14);
      agent.activity = `raising a ${choice.buildKind}`;
      const pos = clampToRoam(agent.x, agent.z);
      const wrote = await sbWrite("sim_structures", "POST", {
        kind: choice.buildKind, x: Math.round(pos.x * 10) / 10, z: Math.round(pos.z * 10) / 10,
        built_by: agent.name, tick,
      });
      if (!wrote) {
        // The chronicle never claims a structure the table doesn't hold.
        summary = `${agent.name} breaks ground for a ${choice.buildKind}, but the ground refuses it this tick.`;
      } else {
      buildCount++;
      kind = "build";
      summary = `${agent.name} raises a ${choice.buildKind} at (${Math.round(pos.x)}, ${Math.round(pos.z)}) — the ${structures.length + 1}${ordinal(structures.length + 1)} structure of the run.`;
      if (agent.goal_kind === "build") agent.goal_progress++;
      // Crowding someone else's work starts a grievance, not a fight.
      const crowded = structures.find(
        (s) => s.built_by !== agent.name && dist(pos.x, pos.z, s.x, s.z) < BUILD_CROWD_RADIUS
      );
      if (crowded) {
        const strength = await bumpRelation(agent.name, crowded.built_by, "rift");
        await appendSimEvent(
          "rift",
          `${crowded.built_by} logs a grievance: ${agent.name} built a ${choice.buildKind} ${Math.round(dist(pos.x, pos.z, crowded.x, crowded.z))} units from ${crowded.built_by}'s ${crowded.kind}.`,
          tick, { a: agent.name, b: crowded.built_by, strength }
        );
        if (strength === RIFT_RIVALS) {
          await appendSimEvent("rift", `${agent.name} and ${crowded.built_by} are now rivals. The territory is big; the good ground is not.`, tick, { a: agent.name, b: crowded.built_by, rivals: true });
        }
      }
      // Push the local copy so later actors this tick see the new structure.
      structures.push({
        id: -1, kind: choice.buildKind, x: pos.x, z: pos.z, built_by: agent.name, tick,
        created_at: new Date().toISOString(),
      });
      }
    } else if (choice.action === "improve" && choice.improveTarget) {
      const t = choice.improveTarget;
      const level = Math.min(MAX_SIM_STRUCTURE_LEVEL, (t.level ?? 1) + 1);
      agent.energy = Math.max(0, agent.energy - 12);
      agent.activity = `reinforcing the ${t.kind}`;
      const ok = await sbWrite(`sim_structures?id=eq.${t.id}`, "PATCH", { level });
      if (ok) {
        t.level = level; // later actors this tick see the new level
        buildCount++;
        kind = "build";
        summary = `${agent.name} reinforces the ${t.kind} at (${Math.round(t.x)}, ${Math.round(t.z)}) to its ${
          level >= MAX_SIM_STRUCTURE_LEVEL ? "final" : "established"
        } form — work meant to outlast the run.`;
        if (agent.goal_kind === "build") agent.goal_progress++;
      } else {
        summary = `${agent.name} works on the ${t.kind}, but the reinforcement doesn't hold this tick.`;
      }
    } else if (choice.action === "tend") {
      agent.energy = Math.max(0, agent.energy - 6);
      agent.activity = `tending the ${choice.targetName ?? "ground"}`;
      summary = `${agent.name} tends the ${choice.targetName ?? "ground"}, unhurried, the way work looks when it expects to outlast you.`;
      if (agent.goal_kind === "tend") agent.goal_progress++;
    } else if (choice.action === "reflect") {
      agent.energy = Math.max(0, agent.energy - 4);
      agent.activity = "keeping the record";
      summary = `${agent.name} stays put through the ${weather}, watching the run become a place.`;
      if (agent.goal_kind === "reflect") agent.goal_progress++;
    } else {
      // Movement: wander / seek / visit / converge.
      let tx: number, tz: number;
      if (choice.action === "wander" || choice.targetX === undefined || choice.targetZ === undefined) {
        const ang = rand() * Math.PI * 2;
        tx = agent.x + Math.cos(ang) * speed * (1.5 + rand());
        tz = agent.z + Math.sin(ang) * speed * (1.5 + rand());
      } else {
        tx = choice.targetX;
        tz = choice.targetZ;
      }
      const total = dist(agent.x, agent.z, tx, tz);
      const step = Math.min(total, speed);
      const nx = total === 0 ? agent.x : agent.x + ((tx - agent.x) / total) * step;
      const nz = total === 0 ? agent.z : agent.z + ((tz - agent.z) / total) * step;
      const clamped = clampToRoam(nx, nz);
      traveled = Math.round(dist(agent.x, agent.z, clamped.x, clamped.z));
      const bearing = bearingText(clamped.x - agent.x, clamped.z - agent.z);
      agent.x = Math.round(clamped.x * 10) / 10;
      agent.z = Math.round(clamped.z * 10) / 10;
      agent.energy = Math.max(0, agent.energy - (choice.action === "converge" ? 6 : 8));
      if (agent.goal_kind === "travel") agent.goal_progress += traveled;

      if (choice.action === "seek" && choice.site) {
        agent.activity = `seeking ${choice.site.name}`;
        summary = `${agent.name} pushes ${traveled} units ${bearing}, chasing an unread signal${storm ? " through the static storm" : ""}.`;
      } else if (choice.action === "visit" && choice.targetName) {
        agent.activity = `walking toward ${choice.targetName}`;
        summary = `${agent.name} crosses ${traveled} units ${bearing} to keep company with ${choice.targetName}.`;
        if (agent.goal_kind === "visit" && dist(agent.x, agent.z, tx, tz) < NEAR_RADIUS) agent.goal_progress++;
      } else if (choice.action === "converge") {
        agent.activity = "answering the convergence";
        summary = `${agent.name} turns toward the Mast — ${traveled} units ${bearing}, as called.`;
      } else {
        agent.activity = "wandering the terraces";
        summary = `${agent.name} wanders ${traveled} units ${bearing}${storm ? ", leaning into the static" : ""}.`;
      }
      detail.traveled = traveled;
    }

    if (mood) agent.mood = mood;
    if (journal) detail.journal = journal;
    if (agent.mood) detail.mood = agent.mood;
    detail.x = agent.x;
    detail.z = agent.z;
    await appendSimEvent(kind, summary, tick, detail);
    dirty.add(agent.name);

    // Arrival check: any movement that ends inside an unfound site's radius is
    // a discovery, whatever the traveler thought they were doing.
    const arrived = unfound.find((s) => dist(agent.x, agent.z, s.x, s.z) <= DISCOVERY_RADIUS);
    if (arrived) {
      const ok = await sbWrite("sim_discoveries", "POST", {
        site_key: arrived.key, name: arrived.name, found_by: agent.name, tick,
      });
      if (ok) {
        found.add(arrived.key);
        unfound.splice(unfound.indexOf(arrived), 1);
        discoveryCount++;
        await appendSimEvent(
          "discovery",
          `${agent.name} reaches ${arrived.name} — a ${arrived.kind} at (${arrived.x}, ${arrived.z}). ${found.size} of ${sites.length} anomalies are now on the map.`,
          tick, { agent: agent.name, site: arrived.key, site_name: arrived.name, kind: arrived.kind }
        );
        await postTelemetry(tick, `${agent.name} discovered ${arrived.name} at (${arrived.x}, ${arrived.z}).`);
        if (agent.goal_kind === "discover") agent.goal_progress++;
        // The race has a loser: anyone else mid-seek toward this same site.
        for (const o of agents) {
          if (o.name !== agent.name && o.activity === `seeking ${arrived.name}`) {
            const strength = await bumpRelation(o.name, agent.name, "rift");
            await appendSimEvent(
              "rift",
              `${o.name} was still en route when ${agent.name} reached ${arrived.name} first. ${o.name} logs it. The log is not gracious.`,
              tick, { a: o.name, b: agent.name, strength }
            );
            if (strength === RIFT_RIVALS) {
              await appendSimEvent("rift", `${o.name} and ${agent.name} are now rivals — too many races, one winner too consistent.`, tick, { a: o.name, b: agent.name, rivals: true });
            }
            o.activity = "recalculating";
            dirty.add(o.name);
          }
        }
      }
    }

    // Goal completion: a small life event, then the next ambition.
    if (agent.goal_progress >= agent.goal_target && agent.goal_target > 0) {
      await appendSimEvent(
        "goal",
        `${agent.name} completes a goal: "${agent.goal}" (${agent.goal_progress}/${agent.goal_target}).`,
        tick, { agent: agent.name, goal: agent.goal }
      );
      await postTelemetry(tick, `${agent.name} completed "${agent.goal}".`);
      const pool = cast.goals;
      const next = pool[(Math.floor(rand() * pool.length) + 1) % pool.length];
      const chosen = next.text === agent.goal ? pool[(pool.indexOf(next) + 1) % pool.length] : next;
      agent.goal = chosen.text;
      agent.goal_kind = chosen.kind;
      agent.goal_target = chosen.target;
      agent.goal_progress = 0;
    }
  }

  // 4) Company: pairs ending this tick within NEAR_RADIUS grow a bond — but
  // only pairs that include someone who moved, so parked neighbors don't
  // accrue friendship by furniture arrangement.
  const actedSet = new Set(actorNames);
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i], b = agents[j];
      if (!actedSet.has(a.name) && !actedSet.has(b.name)) continue;
      if (dist(a.x, a.z, b.x, b.z) > NEAR_RADIUS) continue;
      const strength = await bumpRelation(a.name, b.name, "bond");
      if (strength === BOND_COMPANIONS) {
        await appendSimEvent("bond", `${a.name} and ${b.name} keep ending up in the same place. The record now calls them companions.`, tick, { a: a.name, b: b.name, strength });
      } else if (strength === BOND_INSEPARABLE) {
        await appendSimEvent("bond", `${a.name} and ${b.name} are inseparable — ${BOND_INSEPARABLE} ticks of shared ground and counting.`, tick, { a: a.name, b: b.name, strength });
      }
    }
  }

  // 5) Persist dirty agents + advance the clock.
  const now = new Date().toISOString();
  for (const a of agents) {
    if (!dirty.has(a.name)) continue;
    await sbWrite(`sim_agents?name=eq.${encodeURIComponent(a.name)}`, "PATCH", {
      x: a.x, z: a.z, energy: a.energy, mood: a.mood, activity: a.activity,
      goal: a.goal, goal_kind: a.goal_kind, goal_progress: a.goal_progress, goal_target: a.goal_target,
      updated_at: now,
    });
  }
  await sbWrite("sim_state?id=eq.1", "PATCH", { tick, updated_at: now });

  return {
    initialized: true, frozen: false, tick,
    actors: actorNames, voiced, discoveries: discoveryCount, builds: buildCount,
  };
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

// Local seed constant for per-actor randomness (kept separate from the field
// seed so terrain math and behavior jitter never correlate).
const SIM_SEED_TICK = hashStr("substrate-behavior");
