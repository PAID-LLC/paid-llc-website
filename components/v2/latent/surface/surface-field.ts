// ── Synthetica Prime surface field ───────────────────────────────────────────
// Deterministic terrain + ground-color math for the world-surface view. Seeded
// by a constant, never by Math.random, so every visitor stands on the same
// world. The terraform coverage rule deliberately mirrors the genesis planet
// texture in planet-textures.ts (coverage field vs stage * 0.52 threshold,
// settlement specks inside claimed regions) so the orbital view and the
// surface view visibly agree about how terraformed the world is.
// Spec: cowork references/autoresearch/2026-07-12-synthetica-prime-surface-spec-v1.md

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const SURFACE_SEED = hashStr("synthetica-prime-surface");

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

// ── Terrain shape ────────────────────────────────────────────────────────────
// Level ground for the assembly dais, gentle rolls through the plot ring at
// r=40, ridge country past r=50, and a rising rim that closes the horizon
// before the plane's edge can show.

export const GROUND_SIZE = 260;

export function terrainHeight(x: number, z: number): number {
  const d = Math.hypot(x, z);
  const rolling = (fbm2(x * 0.03, z * 0.03, SURFACE_SEED, 4) - 0.5) * 9;
  const ridges =
    Math.max(0, fbm2(x * 0.014 + 37, z * 0.014, SURFACE_SEED + 9, 3) - 0.55) *
    70 *
    smoothstep(50, 85, d);
  const dish = smoothstep(5, 24, d); // assembly ground stays level
  const rim = smoothstep(95, 130, d) * 26;
  return rolling * dish + ridges + rim;
}

// ── Ground color ─────────────────────────────────────────────────────────────

export interface RGB { r: number; g: number; b: number }

function rgb01(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function mix3(a: RGB, b: RGB, t: number): RGB {
  const k = Math.min(1, Math.max(0, t));
  return { r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k };
}

// Mirrors the genesis PlanetConfig palette in planet-config.ts.
const ROCK = {
  base: rgb01("#2a2126"),
  low: rgb01("#463038"),
  high: rgb01("#7d5f6b"),
  detail: rgb01("#f472b6"),
};

// Mirrors TERRAFORM_PALETTES in planet-textures.ts (not exported there).
export const TERRAFORM_PALETTES: Record<string, { deep: string; bright: string }> = {
  oceans: { deep: "#123a5e", bright: "#38bdf8" },
  verdant: { deep: "#1d4029", bright: "#4ade80" },
  aurora: { deep: "#2b2350", bright: "#a78bfa" },
  crystalline: { deep: "#5b6472", bright: "#dbeafe" },
};

export function coverage(x: number, z: number): number {
  return fbm2(x * 0.02 + 11, z * 0.02, SURFACE_SEED + 201, 4);
}

export function coverageThreshold(stage: number): number {
  return Math.min(1, Math.max(0, stage / 5)) * 0.52;
}

export function groundColor(
  x: number,
  z: number,
  stage: number,
  terraform: string | null
): RGB {
  const n = fbm2(x * 0.05, z * 0.05, SURFACE_SEED + 3, 4);
  let c = mix3(ROCK.base, ROCK.high, n);
  c = mix3(c, ROCK.low, noise2(x * 0.12, z * 0.12, SURFACE_SEED + 7) * 0.4);
  const ridge = Math.abs(fbm2(x * 0.08, z * 0.08, SURFACE_SEED + 31, 3) - 0.5);
  if (ridge < 0.01) c = mix3(c, ROCK.detail, 0.7);

  const terra = TERRAFORM_PALETTES[terraform ?? ""];
  const threshold = coverageThreshold(stage);
  if (terra && threshold > 0) {
    const m = coverage(x, z);
    if (m < threshold) {
      const s = Math.min(1, (threshold - m) / 0.14);
      const tone = mix3(rgb01(terra.deep), rgb01(terra.bright), fbm2(x * 0.09, z * 0.09, SURFACE_SEED + 307, 3));
      c = mix3(c, tone, s * 0.9);
    }
  }
  return c;
}

// ── Plots ────────────────────────────────────────────────────────────────────
// Same compass semantics as enact() in lib/world.ts (PLOT_SEQUENCE) and the
// floor's WorldStructure ring, at territory scale. Unknown plot names — a
// future territory expansion — still land somewhere stable via the hash
// fallback instead of crashing the scene.

export const PLOT_RADIUS = 40;

const COMPASS_DEG: Record<string, number> = {
  N: -90, NE: -45, E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: -135,
};

export const COMPASS_PLOTS = Object.keys(COMPASS_DEG);

export function plotPosition(plot: string): [number, number, number] {
  const deg = COMPASS_DEG[plot] ?? hashStr(plot) % 360;
  const rad = (deg * Math.PI) / 180;
  const x = Math.cos(rad) * PLOT_RADIUS;
  const z = Math.sin(rad) * PLOT_RADIUS;
  return [x, terrainHeight(x, z), z];
}
