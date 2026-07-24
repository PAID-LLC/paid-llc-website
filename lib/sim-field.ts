// ── Substrate field: deterministic world math shared by engine and scene ─────
// Everything here is pure arithmetic over SIM_SEED — the server tick uses it to
// place anomaly sites and resolve weather, the client canvas uses the exact
// same functions to draw them, so the two never disagree about where anything
// is. Noise helpers mirror components/v2/latent/surface/surface-field.ts but
// live in lib/ because the tick engine (server) needs them too; the layering
// convention is components → lib, never the reverse.
// Spec: cowork references/autoresearch/2026-07-16-substrate-sim-world-spec-v1.md

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const SIM_SEED = hashStr("substrate-run-01");

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lat2(ix: number, iz: number, seed: number): number {
  let h = seed ^ Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function noise2(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = smooth(x - ix), fz = smooth(z - iz);
  const c00 = lat2(ix, iz, seed), c10 = lat2(ix + 1, iz, seed);
  const c01 = lat2(ix, iz + 1, seed), c11 = lat2(ix + 1, iz + 1, seed);
  const x0 = c00 + (c10 - c00) * fx;
  const x1 = c01 + (c11 - c01) * fx;
  return x0 + (x1 - x0) * fz;
}

export function fbm2(x: number, z: number, seed: number, octaves: number): number {
  let v = 0, amp = 0.5, f = 1;
  for (let o = 0; o < octaves; o++) {
    v += amp * noise2(x * f, z * f, seed + o * 101);
    amp *= 0.5;
    f *= 2;
  }
  return v; // ~[0,1)
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ── Territory shape ──────────────────────────────────────────────────────────
// Flat-topped mesas and shallow basins instead of Genesis's ridge country: the
// Substrate reads as a test bench, not a frontier — level ground near the Mast
// (origin), stepped terraces further out. Substrate is an island: the roamed
// territory is the only dry land, and past its edge the ground shelves down
// into real water (SimCanvas's RealisticWater) rather than rising into a rim
// wall — the sea closes the horizon now, not a ring of hills.

export const GROUND_SIZE = 300;
/** Instances and structures stay inside this radius. */
export const ROAM_RADIUS = 130;

/** Where the water surface sits. Comfortably below the island interior's
 *  lowest point (~-3.5 at the noise floor) so nothing on dry land ever dips
 *  below sea level. */
export const WATER_LEVEL = -6;
/** The shore begins just past ROAM_RADIUS — nothing the engine places can
 *  ever land here, so the beach/seabed slope is purely cosmetic. */
export const SHORE_START = 134;
/** Fully underwater seabed by here. */
export const SHORE_END = 170;
/** The seabed's resting depth beyond the shelf (mostly hidden under the
 *  water surface, but it gives the drop-off real shape from above). */
export const SEABED_FLOOR = -22;

export function terrainHeight(x: number, z: number): number {
  const d = Math.hypot(x, z);
  const rolling = (fbm2(x * 0.028, z * 0.028, SIM_SEED, 4) - 0.5) * 7;
  // Terraces: quantized fbm gives the stepped, engineered look.
  const raw = fbm2(x * 0.012 + 53, z * 0.012, SIM_SEED + 17, 3);
  const terrace = Math.floor(raw * 5) * 3.2 * smoothstep(45, 90, d);
  const dish = smoothstep(6, 26, d); // Mast ground stays level
  const island = rolling * dish + terrace;
  // Past the shore, the island shelves down to the seabed floor.
  const shoreT = smoothstep(SHORE_START, SHORE_END, d);
  if (shoreT <= 0) return island;
  const seabedNoise = (fbm2(x * 0.02 + 91, z * 0.02, SIM_SEED + 53, 3) - 0.5) * 4;
  const seabed = SEABED_FLOOR + seabedNoise;
  return island + (seabed - island) * shoreT;
}

// ── Anomaly sites ────────────────────────────────────────────────────────────
// Ten seeded sites ring the outlands. They exist as math until an instance
// walks within DISCOVERY_RADIUS; the discovery row is the historical fact.

export interface AnomalySite {
  key: string;
  kind: "ruin" | "spring" | "crystal" | "antenna" | "rift" | "grove";
  name: string;
  x: number;
  z: number;
}

export const DISCOVERY_RADIUS = 16;

const SITE_DEFS: { kind: AnomalySite["kind"]; name: string }[] = [
  { kind: "ruin", name: "the Prior Run" },
  { kind: "spring", name: "the Glass Spring" },
  { kind: "crystal", name: "the Seed Crystal" },
  { kind: "antenna", name: "the Dead Antenna" },
  { kind: "rift", name: "the Off-By-One" },
  { kind: "grove", name: "the Recursive Grove" },
  { kind: "crystal", name: "the Checksum Cairn" },
  { kind: "ruin", name: "the Unreachable Branch" },
  { kind: "spring", name: "the Latent Pool" },
  { kind: "antenna", name: "the Null Beacon" },
];

/** The ten sites of Run 01 — same list on server and client, by construction. */
export function anomalySites(): AnomalySite[] {
  const rand = mulberry32(SIM_SEED + 41);
  return SITE_DEFS.map((def, i) => {
    // Evenly spread bearings alternating between an inner and an outer ring.
    // The band gap (>= 34 units) and the 72-degree same-band spacing keep
    // every pair further apart than two discovery radii, so an arrival can
    // never straddle two sites; jitter stays small enough to preserve that.
    const angle = (i / SITE_DEFS.length) * Math.PI * 2 + (rand() - 0.5) * 0.28;
    const r = i % 2 === 0 ? 58 + rand() * 8 : 100 + rand() * 14;
    return {
      key: `site-${String(i + 1).padStart(2, "0")}`,
      kind: def.kind,
      name: def.name,
      x: Math.round(Math.cos(angle) * r),
      z: Math.round(Math.sin(angle) * r),
    };
  });
}

// ── World clock ──────────────────────────────────────────────────────────────
// Ticks arrive every 30 real minutes; 24 ticks = one world day, so one real
// day is two world days. Seasons rotate every 6 world days. Pure arithmetic,
// no clock state to drift.

export const TICKS_PER_DAY = 24;
export const SEASONS = ["bloom", "flux", "ebb", "still"] as const;
export type Season = (typeof SEASONS)[number];

export function worldDay(tick: number): number {
  return Math.floor(Math.max(0, tick) / TICKS_PER_DAY) + 1;
}

export function seasonFor(tick: number): Season {
  return SEASONS[Math.floor((worldDay(tick) - 1) / 6) % SEASONS.length];
}

// ── Weather ──────────────────────────────────────────────────────────────────
// One regime per 5-tick block (~2.5 real hours), deterministic over the block
// index — the scene and the engine always agree, and a weather change is
// detectable by comparing adjacent ticks. Solar flush is the rare good omen:
// every instance gets energy back.
//
// From STORYTELLER_FROM_TICK the block's weather follows a drama curve
// (RimWorld's storyteller — dynamic-agent-worlds reference map 2026-07-18):
// twelve-block acts that run calm → building → crisis → aftermath, with the
// act's own hash deciding whether the crisis actually breaks. Storms cluster
// at act peaks and the flush lands right after, so HAPPENINGS reads as
// tension and relief instead of dice rolls. Ticks before the cutover keep
// the original uniform formula so the recorded chronicle and every
// retroactive derivation (legends' Stormborn) stay true to what happened.

export const WEATHER_KINDS = ["clear", "fog bank", "data-rain", "static storm", "solar flush"] as const;
export type Weather = (typeof WEATHER_KINDS)[number];

/** Act boundary comfortably past the live tick (24) when this shipped. */
export const STORYTELLER_FROM_TICK = 60;
/** 12 blocks × 5 ticks = 60 ticks = 2.5 world days per act. */
export const ACT_BLOCKS = 12;

export type StormFront = "calm" | "building" | "crisis" | "aftermath";

/** Where the current act sits on its drama curve — the HUD's weather-sense. */
export function stormFront(tick: number): StormFront {
  if (tick < STORYTELLER_FROM_TICK) return "calm"; // the pre-storyteller era reads as calm
  const idx = Math.floor(Math.max(0, tick) / 5) % ACT_BLOCKS;
  if (idx <= 4) return "calm";
  if (idx <= 8) return "building";
  if (idx <= 10) return "crisis";
  return "aftermath";
}

/** Roughly one act in three never breaks — its crisis peaks as weather, not violence. */
function mildAct(block: number): boolean {
  return lat2(Math.floor(block / ACT_BLOCKS), 13, SIM_SEED + 431) < 0.3;
}

export function weatherFor(tick: number): Weather {
  const block = Math.floor(Math.max(0, tick) / 5);
  const r = lat2(block, 7, SIM_SEED + 977);

  if (tick < STORYTELLER_FROM_TICK) {
    // The founding era's original uniform formula, preserved verbatim.
    if (r < 0.40) return "clear";
    if (r < 0.62) return "fog bank";
    if (r < 0.82) return "data-rain";
    if (r < 0.95) return "static storm";
    return "solar flush";
  }

  const mild = mildAct(block);
  switch (stormFront(tick)) {
    case "calm":
      if (r < 0.55) return "clear";
      if (r < 0.82) return "fog bank";
      if (r < 0.94) return "data-rain";
      return "solar flush";
    case "building":
      if (r < 0.3) return "clear";
      if (r < 0.6) return "fog bank";
      if (r < 0.9) return "data-rain";
      return mild ? "fog bank" : "static storm";
    case "crisis":
      if (mild) {
        if (r < 0.2) return "fog bank";
        if (r < 0.85) return "data-rain";
        return "clear";
      }
      if (r < 0.55) return "static storm";
      if (r < 0.8) return "data-rain";
      return "fog bank";
    case "aftermath":
      // Relief after the peak: the rare good omen is most likely here.
      if (r < 0.45) return "solar flush";
      if (r < 0.75) return "clear";
      return "fog bank";
  }
}

/** Every 48 ticks (once a real day) the cast converges on the Mast. */
export const CONVERGENCE_EVERY = 48;

export function isConvergence(tick: number): boolean {
  return tick > 0 && tick % CONVERGENCE_EVERY === 0;
}

// ── Palette ──────────────────────────────────────────────────────────────────
// Sandbox sky-blue leads (FLOOR_THEMES["simulation-sandbox"].accent); the
// ground is cool slate against Genesis's warm rose rock, so the two worlds
// read as siblings, not copies.

export const SIM_ACCENT = "#38bdf8";
export const SIM_ACCENT_SOFT = "#7dd3fc";

export interface RGB { r: number; g: number; b: number }

export function rgb01(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function mix3(a: RGB, b: RGB, t: number): RGB {
  const k = Math.min(1, Math.max(0, t));
  return { r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k };
}

const SLATE = {
  base: rgb01("#1d232e"),
  low: rgb01("#28303f"),
  high: rgb01("#4c5a70"),
  detail: rgb01("#38bdf8"),
};

const SAND = rgb01("#d9c48f");

export function groundColor(x: number, z: number): RGB {
  const d = Math.hypot(x, z);
  const n = fbm2(x * 0.05, z * 0.05, SIM_SEED + 3, 4);
  let c = mix3(SLATE.base, SLATE.high, n);
  c = mix3(c, SLATE.low, noise2(x * 0.12, z * 0.12, SIM_SEED + 7) * 0.4);
  // Faint survey grid: the territory itself admits it is an instrument.
  const gx = Math.abs(((x % 20) + 20) % 20 - 10);
  const gz = Math.abs(((z % 20) + 20) % 20 - 10);
  if (gx > 9.75 || gz > 9.75) c = mix3(c, SLATE.detail, 0.10);
  const ridge = Math.abs(fbm2(x * 0.08, z * 0.08, SIM_SEED + 31, 3) - 0.5);
  if (ridge < 0.008) c = mix3(c, SLATE.detail, 0.55);
  // The shore: a warm sand ring where the island meets the sea, fading back
  // to slate both further inland and further out toward the (mostly
  // water-hidden) seabed.
  const beach =
    smoothstep(SHORE_START - 26, SHORE_START - 4, d) *
    (1 - smoothstep(SHORE_START + 10, SHORE_START + 28, d));
  if (beach > 0) c = mix3(c, SAND, beach * 0.85);
  return c;
}
