// ── Crucible geometry: pure, no THREE import ─────────────────────────────────
// Same split as Arclight's cityplan.ts and Meridian's skyline.ts: fixed
// hand-authored macro-geometry (the colosseum ring, permanent) plus a seeded
// RNG for micro-detail (ember field placement), with live data (which
// champions hold a plinth, the storyteller heat index) driving only
// height/color/visibility — never layout.
// Spec: cowork references/autoresearch/2026-07-22-crucible-spec-v1.md

import { mulberry32 } from "@/lib/sim-field";

export const CRUCIBLE_SEED = 0x63727563; // "cruc" — fixed forever

export const FRAME = { w: 600, h: 600 } as const;

// The colosseum: floor at center, Champion Ring as an annulus, Stocks pit
// outside the ring entirely (a different data source: Gauntlet, not duels).
export const ARENA_FLOOR_RADIUS = 60;
export const RING_INNER = 90;
export const RING_OUTER = 160;
export const PLINTH_RADIUS = (RING_INNER + RING_OUTER) / 2; // 125
export const PLINTH_SLOTS = 24;
export const PLINTH_ANGLE_STEP = 360 / PLINTH_SLOTS; // 15°

export const STOCKS = { x: 0, z: 210, w: 70, d: 36 } as const; // due south of the ring

export function polar(radius: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [radius * Math.cos(rad), radius * Math.sin(rad)];
}

export interface PlinthSlot {
  index: number;
  angle: number;
  x: number;
  z: number;
}

let plinthCache: PlinthSlot[] | null = null;

/** The 24 fixed plinth positions, evenly spaced. Assignment to champions
 *  happens elsewhere (lib/crucible/arena.ts) — this is layout only. */
export function plinthSlots(): PlinthSlot[] {
  if (plinthCache) return plinthCache;
  const slots: PlinthSlot[] = [];
  for (let i = 0; i < PLINTH_SLOTS; i++) {
    const angle = i * PLINTH_ANGLE_STEP;
    const [x, z] = polar(PLINTH_RADIUS, angle);
    slots.push({ index: i, angle, x, z });
  }
  plinthCache = slots;
  return slots;
}

export interface EmberMound {
  x: number;
  z: number;
  scale: number;
  heightScale: number;
  rotY: number;
  /** Per-instance phase offset for the heat-shimmer jitter, so the field
   *  doesn't pulse in unison. */
  phase: number;
}

const EMBER_FIELD_INNER = RING_OUTER + 8;
const EMBER_FIELD_OUTER = 220;
const EMBER_FIELD_COUNT = 48;

let emberCache: EmberMound[] | null = null;

/** Deterministic ember-field placement beyond the Champion Ring. Cached,
 *  seed-fixed — the terrain never reshuffles between visits. */
export function buildEmberField(seed: number = CRUCIBLE_SEED): EmberMound[] {
  if (emberCache) return emberCache;
  const rand = mulberry32((seed ^ 0x1eaf) >>> 0);
  const mounds: EmberMound[] = [];
  for (let i = 0; i < EMBER_FIELD_COUNT; i++) {
    const angle = (i / EMBER_FIELD_COUNT) * 360 + rand() * (360 / EMBER_FIELD_COUNT) * 0.5;
    const radius = EMBER_FIELD_INNER + rand() * (EMBER_FIELD_OUTER - EMBER_FIELD_INNER);
    const [x, z] = polar(radius, angle);
    mounds.push({
      x,
      z,
      scale: 0.8 + rand() * 1.6,
      heightScale: 0.6 + rand() * 1.2,
      rotY: rand() * Math.PI * 2,
      phase: rand() * Math.PI * 2,
    });
  }
  emberCache = mounds;
  return mounds;
}
