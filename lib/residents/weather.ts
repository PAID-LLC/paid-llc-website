// ── Per-world weather ────────────────────────────────────────────────────────
//
// Every resident world gets its own sky, and the sky does something. Weather
// here is not decoration: it slows work, changes what a resident chooses to
// do, and closes Waypoint's gates to departing travellers (see travel.ts).
//
// Derived entirely from (world, tick). No table, no cron, no LLM — the same
// contract as lib/sim-field.ts's weather, whose block-and-act structure this
// deliberately reuses rather than reinventing. Two differences from Substrate:
//
//   1. Each world carries its own PHASE OFFSET, so the five worlds are never
//      in lockstep. A storm crossing the Crucible says nothing about the
//      weather over Palimpsest, which is the entire point of five skies
//      instead of one.
//   2. Each world has its own vocabulary. "Static storm" belongs to Substrate;
//      Arclight gets channel fog, the Lathe gets quench steam, Waypoint gets
//      crosswind. A world's weather should be unmistakably its own.
//
// NOT to be confused with the Lathe's existing `weather` field, which is
// arena-evaluation volume wearing a weather label and is real platform data.
// This is the resident layer's sky and lives in the residents namespace.

import { hashStr } from "@/lib/sim-field";
import { RESIDENT_WORLDS, type ResidentWorld } from "@/lib/residents/cast";

/** 5 ticks per regime ≈ 2.5 real hours at the 30-minute world tick. */
export const BLOCK_TICKS = 5;
/** 12 blocks per act, matching Substrate's storyteller cadence. */
export const ACT_BLOCKS = 12;

export type StormFront = "calm" | "building" | "crisis" | "aftermath";

export interface Weather {
  /** Stable id, safe for keys and tests. */
  id: string;
  /** How it reads in the HUD, in the world's own voice. */
  label: string;
  /** Chronicle line, written when this weather arrives. */
  line: string;
  /** 0 fair · 1 mild · 2 rough · 3 severe. */
  severity: 0 | 1 | 2 | 3;
  /** Multiplier on goal progress. Severe weather stops work entirely. */
  work: number;
  /** May a resident begin a journey in this? Waypoint's gate condition. */
  travel: boolean;
  /** Extra weight toward resting, added to the action roll. */
  restBias: number;
  /** Render parameters for the scene's existing ground-fx primitives. */
  fx: {
    mist: number;
    particles: "motes" | "embers" | "sparks" | null;
    tint: string;
    flash: boolean;
  };
}

/** Per-world season names — flavour only, but it dates the chronicle. */
const SEASONS: Record<ResidentWorld, readonly string[]> = {
  arclight: ["long dark", "trade tide", "brownout", "high lamps"],
  crucible: ["banked", "kindling", "white heat", "cooling"],
  palimpsest: ["dry season", "digging weather", "the sandblows", "the still"],
  lathe: ["cold iron", "the quickening", "full forge", "the drawdown"],
  waypoint: ["slack water", "the crossing", "gale season", "clear approach"],
};

/** 24 ticks ≈ one world day at the 30-minute tick; 6 days to a season. */
export const TICKS_PER_DAY = 24;
export const DAYS_PER_SEASON = 6;

export function worldDay(tick: number): number {
  return Math.floor(Math.max(0, tick) / TICKS_PER_DAY) + 1;
}

export function seasonFor(world: ResidentWorld, tick: number): string {
  const seasons = SEASONS[world];
  const i = Math.floor((worldDay(tick) - 1) / DAYS_PER_SEASON) % seasons.length;
  return seasons[i];
}

// ── Per-world weather tables ─────────────────────────────────────────────────
// Five conditions per world, ordered fair → severe. The drama curve picks an
// index into this table, so a world's crisis is always its own worst sky.

const W = (
  id: string,
  label: string,
  line: string,
  severity: 0 | 1 | 2 | 3,
  work: number,
  travel: boolean,
  restBias: number,
  fx: Weather["fx"]
): Weather => ({ id, label, line, severity, work, travel, restBias, fx });

const TABLES: Record<ResidentWorld, Weather[]> = {
  arclight: [
    W("clear_night", "clear night", "The smog lifts off the channel. Every lamp on the row reads sharp.", 0, 1, true, 0,
      { mist: 0.03, particles: "motes", tint: "#2dd4bf", flash: false }),
    W("channel_fog", "channel fog", "Fog comes up off the channel and the arterials go soft.", 1, 0.85, true, 1,
      { mist: 0.22, particles: "motes", tint: "#3d5a55", flash: false }),
    W("ash_fall", "ash fall", "Ash drifts down from the Foundry stacks. The frontages need sweeping again.", 2, 0.6, true, 2,
      { mist: 0.16, particles: "embers", tint: "#6b5a3d", flash: false }),
    W("grid_squall", "grid squall", "A squall crosses the Stacks. Lamps gutter the length of the row.", 3, 0.25, false, 4,
      { mist: 0.3, particles: "sparks", tint: "#1e4a44", flash: true }),
    W("lamp_glare", "lamp glare", "Still, heavy air. The lamps burn haloed and nobody hurries.", 1, 0.9, true, 1,
      { mist: 0.12, particles: "motes", tint: "#f5c580", flash: false }),
  ],
  crucible: [
    W("banked_calm", "banked calm", "The braziers sit low and even. Good sand, good air.", 0, 1, true, 0,
      { mist: 0.05, particles: "embers", tint: "#ff6b35", flash: false }),
    W("heat_shimmer", "heat shimmer", "Heat comes off the sand in sheets. The tiers waver.", 1, 0.85, true, 1,
      { mist: 0.1, particles: "embers", tint: "#ffb35c", flash: false }),
    W("ember_wind", "ember wind", "An ember wind crosses the ring. Everything loose is moving.", 2, 0.55, true, 2,
      { mist: 0.2, particles: "embers", tint: "#f97316", flash: false }),
    W("ash_storm", "ash storm", "Ash storm. The ring is gone from the tiers and the braziers are blind.", 3, 0.2, false, 4,
      { mist: 0.38, particles: "embers", tint: "#7c2d12", flash: true }),
    W("cold_snap", "cold snap", "The heat drops out overnight. Iron is cold to the hand.", 1, 0.8, true, 2,
      { mist: 0.14, particles: null, tint: "#5c9ec9", flash: false }),
  ],
  palimpsest: [
    W("still_air", "still air", "Not a breath over the site. Every line of the dig reads clean.", 0, 1, true, 0,
      { mist: 0.04, particles: "motes", tint: "#cbb27e", flash: false }),
    W("dust_veil", "dust veil", "A dust veil settles over the trenches. The far ruins go to outline.", 1, 0.85, true, 1,
      { mist: 0.2, particles: "motes", tint: "#a89263", flash: false }),
    W("dry_lightning", "dry lightning", "Dry lightning walks the ridge. No rain follows it.", 2, 0.6, true, 1,
      { mist: 0.12, particles: "sparks", tint: "#e8d5a0", flash: true }),
    W("sandblow", "sandblow", "A sandblow closes the site. Anything not weighted is buried by morning.", 3, 0.15, false, 5,
      { mist: 0.42, particles: "motes", tint: "#8a7a5c", flash: false }),
    W("cold_dawn", "cold dawn", "Cold dawn over the ruins. The stone holds no warmth at all.", 1, 0.9, true, 1,
      { mist: 0.16, particles: null, tint: "#9db4c0", flash: false }),
  ],
  lathe: [
    W("clear_draught", "clear draught", "The shop draws clean. Smoke goes straight up and out.", 0, 1, true, 0,
      { mist: 0.04, particles: "sparks", tint: "#22d3ee", flash: false }),
    W("quench_steam", "quench steam", "Quench steam fills the floor. The rings vanish and come back.", 1, 0.85, true, 1,
      { mist: 0.26, particles: "sparks", tint: "#67e8f9", flash: false }),
    W("forge_smog", "forge smog", "Forge smog banks up under the roof and nobody's eyes are good.", 2, 0.6, true, 2,
      { mist: 0.3, particles: null, tint: "#4a7bab", flash: false }),
    W("storm_off_the_ridge", "storm off the ridge", "A storm comes off the ridge. The spindle is struck twice before it passes.", 3, 0.2, false, 4,
      { mist: 0.34, particles: "sparks", tint: "#0ea5e9", flash: true }),
    W("cold_draft", "cold draft", "A cold draft runs the floor. The hearth wants feeding all shift.", 1, 0.9, true, 1,
      { mist: 0.1, particles: null, tint: "#a5f3fc", flash: false }),
  ],
  waypoint: [
    W("clear_approach", "clear approach", "Clear approach. Every berth is workable and the beacons carry.", 0, 1, true, 0,
      { mist: 0.03, particles: "motes", tint: "#fcd34d", flash: false }),
    W("ground_fog", "ground fog", "Ground fog on the strip. The far gates are only their own lights.", 1, 0.85, true, 1,
      { mist: 0.28, particles: "motes", tint: "#fde68a", flash: false }),
    W("crosswind", "crosswind", "Crosswind across the concourse. The cranes are working slow and deliberate.", 2, 0.6, true, 1,
      { mist: 0.12, particles: "motes", tint: "#f59e0b", flash: false }),
    W("gale", "gale", "A gale shuts the port. Nothing lifts and nothing lands until it turns.", 3, 0.15, false, 5,
      { mist: 0.4, particles: "sparks", tint: "#b45309", flash: true }),
    W("slack_air", "slack air", "Slack air over the quay. Sound carries the whole length of the strip.", 1, 0.9, true, 1,
      { mist: 0.08, particles: "motes", tint: "#fbbf24", flash: false }),
  ],
};

/** Deterministic 0..1 from two integers and a seed. */
function lat(a: number, b: number, seed: number): number {
  let h = seed ^ Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Each world sits at its own point in the act cycle, so skies never match. */
export function phaseOffset(world: ResidentWorld): number {
  return hashStr(`sky:${world}`) % (ACT_BLOCKS * BLOCK_TICKS);
}

function blockFor(world: ResidentWorld, tick: number): number {
  return Math.floor((Math.max(0, tick) + phaseOffset(world)) / BLOCK_TICKS);
}

/** Where this world's act sits on its drama curve. */
export function frontFor(world: ResidentWorld, tick: number): StormFront {
  const idx = blockFor(world, tick) % ACT_BLOCKS;
  if (idx <= 4) return "calm";
  if (idx <= 8) return "building";
  if (idx <= 10) return "crisis";
  return "aftermath";
}

/** Roughly one act in three peaks as weather rather than as a real storm. */
function mildAct(world: ResidentWorld, block: number): boolean {
  return lat(Math.floor(block / ACT_BLOCKS), 13, hashStr(`act:${world}`)) < 0.34;
}

/**
 * This world's weather at this tick.
 *
 * The drama curve decides severity band; the block hash decides which member
 * of that band. Calm acts never reach the severe entry, so a world does not
 * sit in a permanent storm, and a mild act tops out at rough.
 */
export function weatherFor(world: ResidentWorld, tick: number): Weather {
  const table = TABLES[world];
  const block = blockFor(world, tick);
  const front = frontFor(world, tick);
  const r = lat(block, 7, hashStr(`weather:${world}`));

  let pool: number[];
  if (front === "calm") pool = [0, 0, 1, 4];
  else if (front === "building") pool = [1, 2, 4];
  else if (front === "crisis") pool = mildAct(world, block) ? [2, 2, 1] : [3, 3, 2];
  else pool = [4, 1, 0];

  return table[pool[Math.floor(r * pool.length) % pool.length]];
}

/** Did the sky change between the previous tick and this one? */
export function weatherChanged(world: ResidentWorld, tick: number): boolean {
  if (tick <= 0) return false;
  return weatherFor(world, tick).id !== weatherFor(world, tick - 1).id;
}

/** Everything the HUD and the scene need for one world's sky. */
export interface SkyReport {
  world: ResidentWorld;
  tick: number;
  season: string;
  day: number;
  front: StormFront;
  weather: Weather;
  /** True when the port is shut — no journey may begin anywhere this tick. */
  grounded: boolean;
}

export function skyFor(world: ResidentWorld, tick: number): SkyReport {
  return {
    world,
    tick,
    season: seasonFor(world, tick),
    day: worldDay(tick),
    front: frontFor(world, tick),
    weather: weatherFor(world, tick),
    grounded: !weatherFor(world, tick).travel,
  };
}

/** All five skies at one tick — used by the universe-scale reads. */
export function allSkies(tick: number): SkyReport[] {
  return RESIDENT_WORLDS.map((w) => skyFor(w, tick));
}
