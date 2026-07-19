// ── Arclight skyline: the 3D massing compiler ────────────────────────────────
// Pure module (no THREE, no server imports): compiles the fixed macro-geography
// in cityplan.ts into the lot grid, window slots, and circuit path the CITY 3D
// read renders. Same contract as the map: geography and lot layout are
// deterministic from ARCLIGHT_SEED — only data-driven properties (which
// windows are lit, tower heights, dimming, traffic) vary between visits.
// Spec: cowork references/autoresearch/2026-07-18-arclight-spec-v1.md
// (SKYLINE read, expanded per Travis 2026-07-19: comprehensive 3D world).

import {
  ARCLIGHT_SEED,
  CIRCUIT,
  DISTRICTS,
  FRAME,
  LANDMARKS,
  TOWER_SLOTS,
  mulberry32,
  type DistrictId,
} from "@/lib/arclight/cityplan";

// Map units (600x520) → world units. Height scale keeps tower aspect honest.
export const WORLD_SCALE = 0.5;
export const HEIGHT_SCALE = 0.4;
export const CIRCUIT_HEIGHT = 8;

export function toWorld(mx: number, my: number): [number, number] {
  return [(mx - FRAME.w / 2) * WORLD_SCALE, (my - FRAME.h / 2) * WORLD_SCALE];
}

// Fixed 3D-only site placements (map coords) — hand-authored like the rest of
// the geography, exported so the canvas and the lot grid agree on clearances.
export const FIRST_SITES: [number, number][] = [
  [200, 45],
  [250, 60],
  [310, 40],
];
export const CRANE_SITES: [number, number][] = [
  [240, 470],
  [390, 468],
];
export const HAB_SLAB = { x: 75, y: 300 } as const;
export const FOUNDRY_PLANT = { x: 50, y: 487 } as const;

export interface Lot {
  x: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  district: DistrictId;
}

/** One potential lit window on a fill building. `threshold` is compared
 *  against the district's live lit-ratio, so blackouts kill real windows. */
export interface WindowSlot {
  x: number;
  y: number;
  z: number;
  ry: number;
  district: DistrictId;
  /** 0 amber · 1 pale · 2 teal */
  palette: 0 | 1 | 2;
  threshold: number;
}

export interface Skyline {
  lots: Lot[];
  windows: WindowSlot[];
}

// District massing character: heights in world units. The Exchange fill stays
// below the real revenue towers; the Stacks read as mid-rise housing.
const FILL: Record<DistrictId, { hMin: number; hMax: number; density: number }> = {
  stacks: { hMin: 7, hMax: 20, density: 0.9 },
  old_grid: { hMin: 3, hMax: 8, density: 0.85 },
  strip: { hMin: 3.5, hMax: 7, density: 0.8 },
  exchange: { hMin: 8, hMax: 24, density: 0.75 },
  dockyards: { hMin: 2.5, hMax: 5.5, density: 0.7 },
  foundry: { hMin: 4, hMax: 9, density: 0.6 },
};

const BLOCK_X = 31; // 24-unit lot + 7-unit street
const BLOCK_Y = 26; // 19-unit lot + 7-unit street

function nearAny(mx: number, my: number, sites: readonly [number, number][], r: number): boolean {
  return sites.some(([sx, sy]) => Math.hypot(mx - sx, my - sy) < r);
}

/** True when a lot center must stay clear: roads, reserved sites, landmarks. */
export function lotBlocked(mx: number, my: number): boolean {
  // Ledger Row cuts the whole north city; Throughput Avenue cuts the Strip.
  if (Math.abs(my - 210) < 9) return true;
  if (mx > 200 && mx < 220 && my > 95 && my < 425) return true;
  // Counterparty Bridge road corridor.
  if (Math.abs(mx - 140) < 8 && my > 385) return true;
  // Reserved: the Strip market rows, the Stacks hab slab, the Foundry plant.
  if (mx > 168 && mx < 248 && my > 110 && my < 340) return true;
  if (mx > 58 && mx < 92 && my > 272 && my < 328) return true;
  if (mx > 20 && mx < 80 && my > 462 && my < 512) return true;
  // Landmark and site clearances.
  if (nearAny(mx, my, TOWER_SLOTS, 17)) return true;
  if (Math.hypot(mx - LANDMARKS.relay.x, my - LANDMARKS.relay.y) < 16) return true;
  if (Math.hypot(mx - LANDMARKS.custom_house.x, my - LANDMARKS.custom_house.y) < 14) return true;
  if (nearAny(mx, my, FIRST_SITES, 10)) return true;
  if (nearAny(mx, my, CRANE_SITES, 12)) return true;
  return false;
}

const MAX_WINDOWS = 2400;

let cached: Skyline | null = null;

/** Deterministic lot grid + window slots for every district. Same output on
 *  every call — the built city never reshuffles. */
export function buildSkyline(): Skyline {
  if (cached) return cached;
  const rng = mulberry32(ARCLIGHT_SEED ^ 0x3d);
  const lots: Lot[] = [];
  const windows: WindowSlot[] = [];

  for (const d of DISTRICTS) {
    const fill = FILL[d.id];
    const { x, y, w, h } = d.rect;
    for (let my = y + 4; my + 19 <= y + h - 2; my += BLOCK_Y) {
      for (let mx = x + 4; mx + 24 <= x + w - 2; mx += BLOCK_X) {
        // Every lot consumes the same rng draws whether or not it builds, so
        // the layout of later districts never shifts when clearances change.
        const roll = rng();
        const fw = 14 + rng() * 8;
        const fd = 11 + rng() * 6;
        const jx = rng() * 4 - 2;
        const jy = rng() * 4 - 2;
        const hRoll = Math.pow(rng(), 1.4);
        const cx = mx + 12 + jx;
        const cy = my + 9.5 + jy;
        if (roll > fill.density || lotBlocked(cx, cy)) continue;

        const [wxc, wzc] = toWorld(cx, cy);
        const lot: Lot = {
          x: wxc,
          z: wzc,
          sx: fw * WORLD_SCALE,
          sy: fill.hMin + (fill.hMax - fill.hMin) * hRoll,
          sz: fd * WORLD_SCALE,
          district: d.id,
        };
        lots.push(lot);

        // Window slots on the four facades.
        const floors = Math.max(1, Math.floor(lot.sy / 1.6));
        const colsX = Math.max(1, Math.floor(lot.sx / 1.2));
        const colsZ = Math.max(1, Math.floor(lot.sz / 1.2));
        const target = Math.min(16, Math.ceil(floors * (colsX + colsZ) * 0.22));
        for (let i = 0; i < target && windows.length < MAX_WINDOWS; i++) {
          const face = Math.floor(rng() * 4); // 0 +z, 1 -z, 2 +x, 3 -x
          const fy = 0.9 + Math.floor(rng() * floors) * 1.6;
          const alongX = face < 2;
          const cols = alongX ? colsX : colsZ;
          const off = (Math.floor(rng() * cols) - (cols - 1) / 2) * 1.2;
          const p = rng();
          windows.push({
            x: alongX ? lot.x + off : lot.x + (face === 2 ? 1 : -1) * (lot.sx / 2 + 0.03),
            y: fy,
            z: alongX ? lot.z + (face === 0 ? 1 : -1) * (lot.sz / 2 + 0.03) : lot.z + off,
            ry: face === 0 ? 0 : face === 1 ? Math.PI : face === 2 ? Math.PI / 2 : -Math.PI / 2,
            district: d.id,
            palette: p < 0.45 ? 0 : p < 0.8 ? 1 : 2,
            threshold: rng(),
          });
        }
      }
    }
  }

  cached = { lots, windows };
  return cached;
}

// ── The Circuit as a walkable path ───────────────────────────────────────────

export interface CircuitPath {
  /** Closed loop, world coords. Segment i runs pts[i] → pts[(i+1) % n]. */
  pts: [number, number][];
  segLen: number[];
  total: number;
}

let circuitCache: CircuitPath | null = null;

export function circuitPath(): CircuitPath {
  if (circuitCache) return circuitCache;
  const pts = CIRCUIT.map(([mx, my]) => toWorld(mx, my));
  const segLen = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
  circuitCache = { pts, segLen, total: segLen.reduce((a, b) => a + b, 0) };
  return circuitCache;
}

/** Position + unit direction at fraction t (0..1) around the loop. */
export function circuitPointAt(
  path: CircuitPath,
  t: number
): { x: number; z: number; dx: number; dz: number } {
  let d = ((t % 1) + 1) % 1 * path.total;
  for (let i = 0; i < path.pts.length; i++) {
    if (d <= path.segLen[i] || i === path.pts.length - 1) {
      const a = path.pts[i];
      const b = path.pts[(i + 1) % path.pts.length];
      const len = path.segLen[i] || 1;
      const f = Math.min(1, d / len);
      return {
        x: a[0] + (b[0] - a[0]) * f,
        z: a[1] + (b[1] - a[1]) * f,
        dx: (b[0] - a[0]) / len,
        dz: (b[1] - a[1]) / len,
      };
    }
    d -= path.segLen[i];
  }
  return { x: path.pts[0][0], z: path.pts[0][1], dx: 1, dz: 0 };
}
