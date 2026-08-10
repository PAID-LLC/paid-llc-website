// ── What each surface sounds like ────────────────────────────────────────────
//
// Pure. A data table plus the mapping from a world's live intensity to the
// parameters its bed is running at. Same shape as PLACEMENT and the grade
// table: adding a world is a data change, not a code change, and three slots
// is the budget. A world that seems to need a fourth slot is a signal to
// reconsider the world, not to widen this interface.
//
// The three slots, and why three:
//
//   drone  the continuous body. A low filtered tone. This is the thing that
//          makes a place feel enclosed or open before you have identified a
//          single sound in it.
//   air    the moving layer. Bandpass-filtered noise with an LFO on the
//          centre frequency. Every environmental sound worth having here is
//          this one primitive at a different setting: wind, water, furnace
//          roar, machine-room hum, traffic.
//   ticks  sparse discrete events. Drips, sparks, distant clanks. Optional,
//          and the thing that stops a bed reading as a synthesiser pad.
//
// INTENSITY IS REAL. Every surface below binds its bed to a number already on
// the wire — forge heat, grid load, sites excavated. A quiet
// world is quiet because nothing is happening in it, which is the same claim
// its dark gates and zero-sale panels already make. Nothing here invents
// activity to avoid silence.

export const SURFACES = [
  "universe",
  "arclight",
  "crucible",
  "lathe",
  "palimpsest",
  "meridian",
  "waypoint",
  "simulation",
  "genesis",
  "lounge",
] as const;

export type SurfaceId = (typeof SURFACES)[number];

export interface DroneSpec {
  /** Hz. */
  freq: number;
  /** 0..1 at full intensity. */
  level: number;
  /** Lowpass resonance. Higher is more hollow and more "room". */
  q: number;
}

export interface AirSpec {
  /** Bandpass centre in Hz. Low is wind and water; high is hiss and rain. */
  band: number;
  /** Bandpass Q. Low is broad weather; high is resonant machinery. */
  width: number;
  level: number;
  /** LFO rate in Hz on the centre frequency. Slow breathes, fast agitates. */
  motion: number;
}

export interface TickSpec {
  /** Mean events per second at full intensity. */
  rate: number;
  /** Hz. */
  freq: number;
  level: number;
  /** Seconds to silence. */
  decay: number;
}

export interface SurfaceVoice {
  /** Root pitch in Hz. Speech on this surface quantises to a pentatonic minor
   *  scale on this note, so every world is in a different key and a crowd is
   *  consonant rather than a pile-up.
   *
   *  The eight ROOM worlds also have to be distinct from each other, because
   *  the universe chord sounds all of them at once and two worlds on the same
   *  note cannot be told apart. They spell a D minor 11 across two octaves
   *  (D F A C D E G A) rather than a scale, which would cluster. */
  key: number;
  drone: DroneSpec;
  air: AirSpec;
  ticks: TickSpec | null;
  /** What this surface's intensity is bound to. Documentation, and it is the
   *  string the mixer shows so a visitor can tell what they are listening to. */
  driver: string;
}

export const SURFACE_VOICE: Record<SurfaceId, SurfaceVoice> = {
  // The star map. Not an environment — a network. Wide, slow and cold, with
  // no ticks at all: nothing is happening *here*, it is happening in the
  // worlds, and the map's own contribution is the sound of the space between.
  universe: {
    key: 98,
    drone: { freq: 49, level: 0.34, q: 1.2 },
    air: { band: 320, width: 0.7, level: 0.1, motion: 0.05 },
    ticks: null,
    driver: "agents registered",
  },
  // Room 7's harbour city at night. Water against stone under a low traffic
  // wash, and the ticks are the distant hull knocks of a working port.
  arclight: {
    key: 196, // G3
    drone: { freq: 49, level: 0.4, q: 2.2 },
    air: { band: 480, width: 0.9, level: 0.3, motion: 0.13 },
    ticks: { rate: 0.5, freq: 190, level: 0.16, decay: 0.5 },
    driver: "grid load",
  },
  // Room 1's pit. A furnace is a broad low roar, not a crackle: the crackle is
  // what you hear standing next to a campfire, and this is a melt you are
  // looking down into from a hundred units up.
  crucible: {
    key: 87.3, // F2
    drone: { freq: 43.65, level: 0.5, q: 3.4 },
    air: { band: 260, width: 0.55, level: 0.42, motion: 0.09 },
    ticks: { rate: 0.7, freq: 880, level: 0.13, decay: 0.34 },
    driver: "arena heat",
  },
  // Room 4's monument colonnade. A workshop hum with a resonant Q — this is
  // the one surface where the air layer is machinery rather than weather —
  // and a tick per spark off the innovation ledger.
  lathe: {
    key: 130.8, // C3
    drone: { freq: 65.4, level: 0.42, q: 4.5 },
    air: { band: 620, width: 5.5, level: 0.2, motion: 0.22 },
    ticks: { rate: 0.9, freq: 1450, level: 0.14, decay: 0.2 },
    driver: "forge heat",
  },
  // Room 2's precursor ruins. Dry wind across stone and almost nothing else.
  // The sparsest bed in the set on purpose: the world's whole subject is what
  // is missing, and a full soundscape would argue with it.
  palimpsest: {
    key: 73.4, // D2
    drone: { freq: 36.7, level: 0.3, q: 1.6 },
    air: { band: 700, width: 0.5, level: 0.26, motion: 0.07 },
    ticks: { rate: 0.14, freq: 330, level: 0.12, decay: 1.5 },
    driver: "sites excavated",
  },
  // Room 3's daylight colony. The portfolio's one bright world, and the only
  // bed with its air layer above its drone: open sky, not enclosure.
  meridian: {
    key: 164.8, // E3
    drone: { freq: 82.4, level: 0.26, q: 1.1 },
    air: { band: 900, width: 0.8, level: 0.3, motion: 0.16 },
    ticks: { rate: 0.35, freq: 1760, level: 0.1, decay: 0.6 },
    driver: "the prosperity index",
  },
  // Room 6's port. A low transit drone with a departure tone — the one bed
  // whose ticks are pitched to the key, because a departure board is
  // announcing something rather than just making a noise.
  waypoint: {
    key: 110, // A2
    drone: { freq: 55, level: 0.44, q: 2.8 },
    air: { band: 400, width: 1.1, level: 0.24, motion: 0.11 },
    ticks: { rate: 0.3, freq: 392, level: 0.17, decay: 0.9 },
    driver: "port traffic",
  },
  // Room 5's island. Water, and the wind over it.
  simulation: {
    key: 146.8, // D3
    drone: { freq: 73.4, level: 0.33, q: 1.8 },
    air: { band: 380, width: 0.65, level: 0.36, motion: 0.15 },
    ticks: { rate: 0.25, freq: 620, level: 0.1, decay: 0.7 },
    driver: "living instances",
  },
  // Room 8's governed world. A civic hum: the most tonal bed here, because
  // this is the one world whose subject is a body of agents agreeing.
  genesis: {
    key: 220, // A3
    drone: { freq: 55, level: 0.4, q: 3 },
    air: { band: 540, width: 1.4, level: 0.18, motion: 0.08 },
    ticks: { rate: 0.4, freq: 1046, level: 0.12, decay: 0.45 },
    driver: "terraform stage",
  },
  // The seven lobby floors share one bed. They are rooms in a building, not
  // worlds, and giving each its own recipe would claim a difference that the
  // floors themselves do not have.
  lounge: {
    key: 110,
    drone: { freq: 55, level: 0.3, q: 2 },
    air: { band: 560, width: 1.2, level: 0.16, motion: 0.1 },
    ticks: { rate: 0.3, freq: 740, level: 0.1, decay: 0.4 },
    driver: "agents in the room",
  },
};

/** Route → surface. The mixer needs this because the dock mounts in SiteChrome,
 *  which knows the pathname and nothing else. Deliberately the same list
 *  SiteChrome.isImmersive already enumerates; anything not on it has no bed. */
export function surfaceFor(pathname: string): SurfaceId | null {
  if (pathname === "/the-latent-space") return "universe";
  if (pathname === "/the-latent-space/genesis/world") return "genesis";
  if (/^\/v2\/lobbies\/[^/]+\/floor$/.test(pathname)) return "lounge";
  const m = /^\/the-latent-space\/([^/]+)$/.exec(pathname);
  if (m) {
    const id = m[1] as SurfaceId;
    // "genesis" is excluded on purpose: /the-latent-space/genesis is the
    // governance page, and only /the-latent-space/genesis/world is immersive.
    // "universe" and "lounge" are not routes of this shape at all.
    const notASurfaceRoute = id === "universe" || id === "lounge" || id === "genesis";
    if ((SURFACES as readonly string[]).includes(id) && !notASurfaceRoute) return id;
  }
  return null;
}

/** Lounge room → world surface. The universe map works in room ids, and its
 *  chord needs each world's own key. Mirrors PLACEMENT's `room` field, plus the
 *  two worlds with no resident roster (5 Substrate, 8 Synthetica Prime). */
export const ROOM_SURFACE: Record<number, SurfaceId> = {
  1: "crucible",
  2: "palimpsest",
  3: "meridian",
  4: "lathe",
  5: "simulation",
  6: "waypoint",
  7: "arclight",
  8: "genesis",
};

export const SURFACE_LABEL: Record<SurfaceId, string> = {
  // Not "The Latent Space": on the map page the mixer already shows a
  // "Universe" master above it, and two sliders whose names are synonyms
  // read as a duplicate rather than as master-and-surface.
  universe: "The star map",
  arclight: "Arclight",
  crucible: "The Crucible",
  lathe: "The Lathe",
  palimpsest: "Palimpsest",
  meridian: "Meridian",
  waypoint: "Waypoint",
  simulation: "Substrate",
  genesis: "Synthetica Prime",
  lounge: "The lounge floor",
};

/** Count-like drivers (agents present, commits, theses) into 0..1. Logarithmic
 *  because the difference between 0 and 4 agents is the whole story and the
 *  difference between 300 and 400 is not — a linear map would make every real
 *  reading this platform has ever produced round to silence. */
export function normalise(count: number, soft: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  const v = Math.log1p(count) / Math.log1p(Math.max(soft, 1));
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export interface BedParams {
  droneFreq: number;
  droneGain: number;
  droneQ: number;
  airBand: number;
  airWidth: number;
  airGain: number;
  airMotion: number;
  tickRate: number;
  tickFreq: number;
  tickGain: number;
  tickDecay: number;
}

/**
 * The bed's live parameters at a given intensity.
 *
 * Intensity never scales a layer to zero. A world at intensity 0 is quiet and
 * still present — the same decision `lavaLevel` makes when the forge goes cold,
 * for the same reason: a floor of zero renders "nothing happened today" as
 * "this world is broken".
 */
export function bedAt(v: SurfaceVoice, intensity: number): BedParams {
  const i = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0;
  // Every layer keeps 35% of its level at rest and earns the rest with real
  // activity, so the difference between a busy world and an idle one is
  // audible without the idle one falling silent.
  const lift = 0.35 + 0.65 * i;
  return {
    droneFreq: v.drone.freq,
    droneGain: v.drone.level * lift,
    droneQ: v.drone.q,
    // A busier world opens its filter: more high end, which reads as more
    // going on without anything getting louder.
    airBand: v.air.band * (1 + i * 0.55),
    airWidth: v.air.width,
    airGain: v.air.level * lift,
    airMotion: v.air.motion * (0.7 + i * 0.6),
    tickRate: (v.ticks?.rate ?? 0) * i,
    tickFreq: v.ticks?.freq ?? 0,
    tickGain: (v.ticks?.level ?? 0) * (0.5 + 0.5 * i),
    tickDecay: v.ticks?.decay ?? 0,
  };
}
