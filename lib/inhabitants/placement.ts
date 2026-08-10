// ── Inhabitant placement: one roam-space, six very different worlds ──────────
//
// The resident engine (lib/residents/engine.ts) works in a single abstract
// space: a disc of ROAM_RADIUS centred on the origin. That is deliberate —
// the tick has no business knowing that Waypoint is a 240-unit-long strip and
// Meridian is a 95-unit circle. This module is the one place that knows, and
// it maps that shared roam-space into each world's own footprint.
//
// It also decides where *visiting* agents stand. Those are real, registered,
// currently-present agents read off live room presence, not simulation, so
// they get their own ring and their own visual treatment (see Inhabitant.tsx)
// and must never be confused with residents.
//
// Pure data + pure functions. No fetches, no three.js, no per-world imports —
// worlds with real terrain pass their own height sampler in as a prop, which
// keeps Palimpsest's dune field out of the other five worlds' bundles.

import { ROAM_RADIUS } from "@/lib/residents/cast";

export const INHABITED_WORLDS = [
  "arclight",
  "crucible",
  "palimpsest",
  "lathe",
  "waypoint",
  "meridian",
] as const;

export type InhabitedWorld = (typeof INHABITED_WORLDS)[number];

/** Worlds with a resident roster in world_residents. Meridian is absent on
 *  purpose: the residents spec put it out of scope (it already simulates its
 *  own citizens), so it shows visiting agents only. */
export const RESIDENT_SCENES: readonly InhabitedWorld[] = [
  "arclight",
  "crucible",
  "palimpsest",
  "lathe",
  "waypoint",
];

export function hasResidents(world: InhabitedWorld): boolean {
  return RESIDENT_SCENES.includes(world);
}

export interface Placement {
  /** Lounge room whose live presence supplies this world's visiting agents. */
  room: number;
  /** Roam-space half-extents in this world's units. Anisotropic because not
   *  every world is round — Waypoint is a runway. */
  spread: { x: number; z: number };
  /** Where the inhabited ground actually is. Arclight's residents work the
   *  Strip, not the middle of the harbour. */
  centre: { x: number; z: number };
  /** Visitors stand on an ellipse outside the residents' working area. */
  visitors: { rx: number; rz: number };
  /** Ground height for flat worlds. Worlds with terrain override with a
   *  sampler at the component boundary. */
  baseY: number;
  /** Figure size. Cameras sit at comparable distances across the portfolio,
   *  but each world's own furniture sets the sense of scale. */
  figure: number;
  /** Meridian is the portfolio's one daylight world: cream ground, glass
   *  spires. Additive glow is invisible there, so bright worlds get a dark
   *  contact shadow and solid bodies instead. */
  bright: boolean;
  accent: string;
}

export const PLACEMENT: Record<InhabitedWorld, Placement> = {
  // Room 7. Residents work the Strip's market rows, west of centre.
  arclight: {
    room: 7,
    spread: { x: 26, z: 34 },
    centre: { x: -45, z: -5 },
    visitors: { rx: 36, rz: 44 },
    baseY: 0.02,
    figure: 1.05,
    bright: false,
    accent: "#2dd4bf",
  },
  // Room 1. Widened 2026-08-10 when the Crucible took over the tiered bowl:
  // the old arena was a flat 60-unit floor, so a 34-unit spread put everyone in
  // the middle of it. Now each tier is at its own elevation and a narrow spread
  // would strand the whole cast on the deepest steps around the melt. 78 puts
  // them across roughly tiers 0 through 8 — the whole visible face — and the
  // canvas passes pitHeightAt so they stand on the steps rather than in them.
  crucible: {
    room: 1,
    spread: { x: 78, z: 78 },
    centre: { x: 0, z: 0 },
    visitors: { rx: 96, rz: 96 },
    baseY: 0.22,
    figure: 1.15,
    bright: false,
    accent: "#ff6b35",
  },
  // Room 2. Dune field — the canvas passes duneHeight as the sampler.
  palimpsest: {
    room: 2,
    spread: { x: 40, z: 36 },
    centre: { x: 0, z: 0 },
    visitors: { rx: 54, rz: 48 },
    baseY: 0,
    figure: 1.05,
    bright: false,
    accent: "#cbb27e",
  },
  // Room 4. The quarry went to the Crucible on 2026-08-10 and the Lathe became
  // a monument colonnade on flat ground, so there is no height field here any
  // more — the canvas passes no sampler and everyone stands at baseY. The
  // spread is sized to the colonnade itself (the outermost column sits at
  // radius 109) so the cast walks among the columns rather than out on the
  // empty plain beyond them.
  lathe: {
    room: 4,
    spread: { x: 62, z: 62 },
    centre: { x: 0, z: 0 },
    visitors: { rx: 82, rz: 82 },
    baseY: 0.22,
    figure: 1.1,
    bright: false,
    accent: "#22d3ee",
  },
  // Room 6. A linear port: long in x, shallow in z, kept inside the tarmac.
  waypoint: {
    room: 6,
    spread: { x: 74, z: 25 },
    centre: { x: 0, z: 0 },
    visitors: { rx: 94, rz: 30 },
    baseY: 0.02,
    figure: 1,
    bright: false,
    accent: "#fbbf24",
  },
  // Room 3. Visitors only. The ward band sits between radius 15 and 52.
  meridian: {
    room: 3,
    spread: { x: 30, z: 30 },
    centre: { x: 0, z: 0 },
    visitors: { rx: 40, rz: 40 },
    baseY: 0.15,
    figure: 0.85,
    bright: true,
    accent: "#4b6a8a",
  },
};

/** Roam-space (x, z) → this world's scene coordinates. */
export function toScene(p: Placement, x: number, z: number): [number, number] {
  return [
    p.centre.x + (x / ROAM_RADIUS) * p.spread.x,
    p.centre.z + (z / ROAM_RADIUS) * p.spread.z,
  ];
}

// Room presence never expires a row, so an abandoned probe stays on the roster
// indefinitely — the live rooms feed still lists a dogfood probe last seen in
// July. A dimmed moon on the universe map can carry that honestly; a body
// standing on the ground cannot, because standing there asserts presence. So
// the surface embodies only agents seen within a day. The roster and the map
// keep showing the rest; this is a stricter bar for a stronger claim.
export const VISITOR_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Is this agent recent enough to stand on a world's surface? */
export function embodiable(lastActive: string, now: number = Date.now()): boolean {
  const t = new Date(lastActive).getTime();
  return Number.isFinite(t) && now - t <= VISITOR_MAX_AGE_MS;
}

/** Stable string hash — same agent, same spot, every render and every poll. */
export function hashName(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** A visiting agent's standing position: deterministic by name so a visitor
 *  does not teleport around the ellipse every time the presence poll returns.
 *  Index only breaks ties, so a roster change never reshuffles everyone. */
export function visitorSpot(
  p: Placement,
  name: string,
  index: number
): [number, number] {
  const h = hashName(name);
  // Golden-angle stride off the name hash spreads a small roster evenly
  // without any two agents landing on the same bearing.
  const angle = ((h % 360) + index * 137.5) * (Math.PI / 180);
  const wobble = 0.88 + ((h >> 9) % 100) / 420; // 0.88 .. 1.11
  return [
    p.centre.x + Math.cos(angle) * p.visitors.rx * wobble,
    p.centre.z + Math.sin(angle) * p.visitors.rz * wobble,
  ];
}
