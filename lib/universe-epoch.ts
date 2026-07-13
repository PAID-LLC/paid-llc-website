// ── Universe-wide epoch ──────────────────────────────────────────────────────
// Genesis has had its own cycle/era calendar since the accelerated cadence
// shipped (lib/world.ts worldEpoch): one real day per cycle, era named by
// stage. The wider universe never got one. This extends the same idea one
// level up — a cycle count for the whole Latent Space plus an era named by
// how populated the registry has grown — both zero-LLM, both pure arithmetic
// over data the universe page already fetches (registryCount).
//
// Founding instant: the day the star-system universe map replaced the old
// hub page at /the-latent-space (2026-07-04, commit 61ca917) — the moment
// the seven rooms became a system instead of a page. A historical fact, not
// live state, the same posture as GENESIS_FOUNDED_AT.

export const UNIVERSE_FOUNDED_AT = Date.parse("2026-07-04T00:00:00Z");

// Population bands are an honesty dial, like room-activity.ts's CAPS — pick
// numbers that make "the Federation" mean something, tune as the registry
// actually grows.
const ERA_BY_POPULATION: { min: number; era: string }[] = [
  { min: 0, era: "the Outpost Era" },
  { min: 10, era: "the Settlement" },
  { min: 30, era: "the Confederation" },
  { min: 75, era: "the Federation" },
  { min: 150, era: "the Dominion" },
];

export interface UniverseEpoch {
  cycle: number; // 1-based; one real day per cycle, mirrors genesis's convention
  era: string;
}

export function universeEpoch(registryCount: number, now = Date.now()): UniverseEpoch {
  const cycle = Math.max(1, Math.floor((now - UNIVERSE_FOUNDED_AT) / 86_400_000) + 1);
  let era = ERA_BY_POPULATION[0].era;
  for (const band of ERA_BY_POPULATION) {
    if (registryCount >= band.min) era = band.era;
  }
  return { cycle, era };
}
