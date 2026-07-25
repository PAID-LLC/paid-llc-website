// ── World Residents: per-world configuration ─────────────────────────────────
// Spec: cowork references/autoresearch/2026-07-25-world-residents-spec-v1.md
//
// Data only — no logic. The engine (lib/residents/engine.ts) reads this to
// decide what a resident can build, where it can walk, and how its work reads
// in the chronicle. Keeping the prose here means the seed SQL stays free of
// flavour text and a copy change never needs a migration.

export const RESIDENT_WORLDS = ["arclight", "crucible", "palimpsest", "lathe", "waypoint"] as const;
export type ResidentWorld = typeof RESIDENT_WORLDS[number];

export function isResidentWorld(v: string): v is ResidentWorld {
  return (RESIDENT_WORLDS as readonly string[]).includes(v);
}

/** Shared movement bounds. Each world's scene is centred on the origin. */
export const ROAM_RADIUS = 34;
export const MOVE_SPEED = 6;
/** Builds stop here so the scene stays legible; the world keeps running. */
export const MAX_BUILDS_PER_WORLD = 24;
/** Two residents act per tick, rotating by tick index. */
export const ACTORS_PER_TICK = 2;

export interface WorldConfig {
  /** Room number that hosts the world, for chronicle lines. */
  room: number;
  /** Display name used in summaries. */
  label: string;
  /** What the ground is called, e.g. "the district". */
  ground: string;
  /** Structure kinds a resident of this world can raise. */
  builds: string[];
  /** Verbs for the `tend` action — upkeep work that advances a tend goal. */
  tending: string[];
  /** Verbs for the `study` action — looking, reading, measuring. */
  studying: string[];
  /** Idle/rest phrasing. */
  resting: string[];
}

export const WORLD_CONFIG: Record<ResidentWorld, WorldConfig> = {
  arclight: {
    room: 7,
    label: "Arclight",
    ground: "the district",
    builds: ["lamp", "kiosk", "stall", "sign", "awning", "bench"],
    tending: [
      "running a delivery down the row",
      "trimming a guttering lamp",
      "sweeping the frontage",
      "carrying a crate to the stalls",
    ],
    studying: [
      "reading the traffic on the main row",
      "counting shuttered windows",
      "checking a ledger against the stalls",
    ],
    resting: ["resting under an awning", "waiting out the rain", "warming their hands"],
  },
  crucible: {
    room: 1,
    label: "the Crucible",
    ground: "the sand",
    builds: ["training post", "brazier", "banner", "weapon rack", "bench", "gate marker"],
    tending: [
      "raking the sand flat",
      "drilling footwork along the ring",
      "oiling the racks",
      "banking a brazier for the night",
    ],
    studying: [
      "pacing the ring to measure it",
      "reading the names cut into the tiers",
      "watching the empty stands",
    ],
    resting: ["sitting on the lower tier", "leaning on a post", "catching their breath"],
  },
  palimpsest: {
    room: 2,
    label: "Palimpsest",
    ground: "the site",
    builds: ["trench", "scaffold", "field tent", "catalogue case", "spoil heap", "marker stake"],
    tending: [
      "brushing silt from a recovered leaf",
      "numbering finds into the catalogue",
      "carrying spoil clear of the trench",
      "re-pegging a tent line",
    ],
    studying: [
      "copying a fragment by lamplight",
      "measuring a wall course",
      "comparing two hands on the same leaf",
    ],
    resting: ["resting in the tent's shade", "waiting for the light to turn", "cleaning their tools"],
  },
  lathe: {
    room: 4,
    label: "the Lathe",
    ground: "the shop floor",
    builds: ["anvil", "jig", "rack", "crucible", "bench", "grinding wheel"],
    tending: [
      "working the bellows",
      "quenching a piece in the trough",
      "truing an edge on the wheel",
      "sorting stock back onto the rack",
    ],
    studying: [
      "checking a jig against the mark",
      "reading the grain on a cooled billet",
      "measuring twice before a cut",
    ],
    resting: ["sitting by the cooling trough", "letting the forge draw", "wiping down the bench"],
  },
  waypoint: {
    room: 6,
    label: "Waypoint",
    ground: "the quay",
    builds: ["bollard", "crane", "berth marker", "beacon", "gangway", "cargo stack"],
    tending: [
      "coiling line on the quay",
      "walking a berth to check its fenders",
      "trimming a beacon's wick",
      "chocking a cargo stack",
    ],
    studying: [
      "reading the arrivals board",
      "sighting down the strip for traffic",
      "logging a berth as clear",
    ],
    resting: ["sitting on a bollard", "watching an empty berth", "waiting on the tide"],
  },
};

/** Goal pools, keyed by the goal_kind the engine advances. */
export const NEXT_GOALS: Record<ResidentWorld, { text: string; kind: string; target: number }[]> = {
  arclight: [
    { text: "Raise three more lamps on the dark side", kind: "build", target: 3 },
    { text: "Run six deliveries across the districts", kind: "tend", target: 6 },
    { text: "Read the row for a full night", kind: "study", target: 4 },
    { text: "Put up four awnings before the rain", kind: "build", target: 4 },
  ],
  crucible: [
    { text: "Set three more posts on the sand", kind: "build", target: 3 },
    { text: "Drill the ring eight times", kind: "tend", target: 8 },
    { text: "Walk every tier and count the names", kind: "study", target: 4 },
    { text: "Hang four banners for a crowd that may come", kind: "build", target: 4 },
  ],
  palimpsest: [
    { text: "Open three more trenches", kind: "build", target: 3 },
    { text: "Catalogue six recovered leaves", kind: "tend", target: 6 },
    { text: "Copy five fragments in full", kind: "study", target: 5 },
    { text: "Raise scaffold over the north wall", kind: "build", target: 3 },
  ],
  lathe: [
    { text: "Cut four more jigs", kind: "build", target: 4 },
    { text: "Work the crucibles seven times", kind: "tend", target: 7 },
    { text: "Check every jig against the mark", kind: "study", target: 4 },
    { text: "Stand three racks by the wall", kind: "build", target: 3 },
  ],
  waypoint: [
    { text: "Mark three more berths", kind: "build", target: 3 },
    { text: "Tend the beacons six times", kind: "tend", target: 6 },
    { text: "Log the strip clear end to end", kind: "study", target: 4 },
    { text: "Set four bollards along the new quay", kind: "build", target: 4 },
  ],
};
