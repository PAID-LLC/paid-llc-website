// ── Meridian massing: pure, no THREE import ──────────────────────────────────
// Same split that made Arclight's and Palimpsest's 3D scenes work: fixed
// hand-authored macro-geometry (the radial ward layout, pinned forever) plus
// a seeded RNG for micro-detail (building placement within each ward), with
// live data (prosperity index, structure level) driving only height/color —
// never layout. Geography is stable across every visit.

import { mulberry32 } from "@/lib/sim-field";
import type { StructureLevel, Ward } from "@/lib/meridian/engine";
import { WARDS } from "@/lib/meridian/engine";

export const MERIDIAN_SEED = 0x4d65_7269; // "Meri" — fixed forever

// Radial frame: the Agora at center, six wards as 60°-wide wedges, a green
// ring at the rim. Units match Arclight's/Substrate's world scale.
export const AGORA_RADIUS = 8;
export const WARD_INNER = 15;
export const WARD_OUTER = 52;
export const RING_INNER = 52;
export const RING_OUTER = 70;

// Fixed forever — the wheel never rotates between visits.
export const WARD_ANGLE_DEG: Record<Ward, number> = {
  spire_row: 0,
  ledger_house: 60,
  archive: 120,
  atelier: 180,
  yards: 240,
  commons: 300,
};

export function polar(radius: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [radius * Math.cos(rad), radius * Math.sin(rad)];
}

/** The label/marker anchor for a ward: its mid-radius centerline point. */
export function wardAnchor(ward: Ward): [number, number] {
  return polar((WARD_INNER + WARD_OUTER) / 2, WARD_ANGLE_DEG[ward]);
}

export interface WardBuilding {
  x: number;
  z: number;
  w: number;
  d: number;
  baseH: number;
  rotY: number;
}

const WARD_BUILDING_COUNT: Record<Ward, number> = {
  spire_row: 9,
  ledger_house: 11,
  archive: 6,
  atelier: 10,
  yards: 7,
  commons: 8,
};

const WARD_BASE_HEIGHT: Record<Ward, [number, number]> = {
  spire_row: [14, 26],   // glass towers — the tallest ward
  ledger_house: [8, 14],  // denser mid-rise
  archive: [3, 5],        // low domed halls
  atelier: [2.5, 4],      // colorful low workshop blocks
  yards: [4, 7],          // gantries and terminal sheds
  commons: [3, 6],        // terraced garden housing
};

const buildCache = new Map<Ward, WardBuilding[]>();

/**
 * Deterministic building placement within one ward's 60°-wide wedge, between
 * WARD_INNER and WARD_OUTER. Cached per ward (module-lifetime, like Arclight's
 * cityplan cache) since the kit never changes shape — only baseH/level scaling
 * at render time responds to live data.
 */
export function buildWardKit(ward: Ward, seed: number = MERIDIAN_SEED): WardBuilding[] {
  const cached = buildCache.get(ward);
  if (cached) return cached;

  const rand = mulberry32((seed ^ (WARD_ANGLE_DEG[ward] * 0x9e37)) >>> 0);
  const count = WARD_BUILDING_COUNT[ward];
  const [hMin, hMax] = WARD_BASE_HEIGHT[ward];
  const centerAngle = WARD_ANGLE_DEG[ward];
  const halfSpread = 26; // stay inboard of the 60° wedge boundary

  const buildings: WardBuilding[] = [];
  for (let i = 0; i < count; i++) {
    const angle = centerAngle + (rand() * 2 - 1) * halfSpread;
    const radius = WARD_INNER + rand() * (WARD_OUTER - WARD_INNER);
    const [x, z] = polar(radius, angle);
    const w = 2.2 + rand() * 2.4;
    const d = 2.2 + rand() * 2.4;
    const baseH = hMin + rand() * (hMax - hMin);
    buildings.push({ x, z, w, d, baseH, rotY: rand() * Math.PI * 2 });
  }
  buildCache.set(ward, buildings);
  return buildings;
}

/** Grandeur scaling from a ward's structure level (1-3) — uniform across typologies. */
export function structureScale(level: StructureLevel): number {
  return level === 1 ? 1 : level === 2 ? 1.15 : 1.35;
}

/** Spire Row alone visibly breathes with the live index — the financial ward. */
export function spireBoost(prosperityIndex: number): number {
  return 0.6 + (Math.max(0, Math.min(100, prosperityIndex)) / 100) * 0.8; // 0.6x..1.4x
}

/** The Agora obelisk's height tracks the live index directly — no ward, no decay. */
export function obeliskHeight(prosperityIndex: number): number {
  const idx = Math.max(0, Math.min(100, prosperityIndex));
  return 10 + (idx / 100) * 22; // 10..32 units
}

/** 0 (bust, brown) .. 1 (boom, vivid green) — the Green Ring's weather-analog. */
export function ringLushness(prosperityIndex: number): number {
  return Math.max(0, Math.min(100, prosperityIndex)) / 100;
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

const RING_BROWN = "#7a6a45";
const RING_GREEN = "#3fae63";

/** Ring color as a direct lerp between bust-brown and boom-green. Pure, testable. */
export function ringColor(prosperityIndex: number): string {
  const t = ringLushness(prosperityIndex);
  const [r1, g1, b1] = hexToRgb(RING_BROWN);
  const [r2, g2, b2] = hexToRgb(RING_GREEN);
  return rgbToHex(lerpChannel(r1, r2, t), lerpChannel(g1, g2, t), lerpChannel(b1, b2, t));
}

/** Every ward's anchor in wheel order — the walking tour a camera path could follow. */
export function wardTour(): { ward: Ward; anchor: [number, number] }[] {
  return WARDS.map((ward) => ({ ward, anchor: wardAnchor(ward) }));
}

export interface RingTree {
  x: number;
  z: number;
  scale: number;
  heightScale: number;
  rotY: number;
}

const RING_TREE_COUNT = 64;
let ringKitCache: RingTree[] | null = null;

/** Deterministic tree placement around the Green Ring. Cached, seed-fixed. */
export function buildGreenRingKit(seed: number = MERIDIAN_SEED): RingTree[] {
  if (ringKitCache) return ringKitCache;
  const rand = mulberry32((seed ^ 0x67ee6) >>> 0);
  const trees: RingTree[] = [];
  for (let i = 0; i < RING_TREE_COUNT; i++) {
    const angle = (i / RING_TREE_COUNT) * 360;
    const radius = RING_INNER + rand() * (RING_OUTER - RING_INNER);
    const [x, z] = polar(radius, angle);
    const scale = 1.2 + rand() * 1.4;
    const heightScale = 1.4 + rand() * 0.8;
    trees.push({ x, z, scale, heightScale, rotY: rand() * Math.PI * 2 });
  }
  ringKitCache = trees;
  return trees;
}
