// ── Planet archetypes ────────────────────────────────────────────────────────
// Maps each themed room to a body in a realistic star system. Ordering and
// zoning deliberately mirror the real solar system: rocky worlds inside,
// giants outside, the asteroid belt in the gap between them, the Nexus (the
// arrival hall every agent lands in first) as the star everything orbits.
// Sizes are compressed-but-ordered — real ratios (Jupiter at 11× Earth) don't
// fit one readable frame — and surface palettes are realistic-first, with the
// room's brand accent carried by the atmosphere rim, orbit line, city lights,
// and label instead of being painted across the surface.
//
// Spec: cowork references/autoresearch/2026-07-10-latent-space-realistic-universe-spec-v2-final.md

export type PlanetKind =
  | "sun"
  | "rock" // cratered, heat-cracked (Mercury-class)
  | "terra" // continents, oceans, polar caps, city lights (Earth-class)
  | "cracked-ice" // lineae over an ice shell (Europa-class)
  | "banded-giant" // banded gas giant, optionally ringed (Saturn-class)
  | "smooth-giant" // near-featureless ice giant (Uranus-class)
  | "storm-giant"; // dark storm ovals + bright streaks (Neptune-class)

export interface PlanetConfig {
  kind: PlanetKind;
  /** distance from the sun; 0 = the sun itself */
  orbitRadius: number;
  visualRadius: number;
  /** radians, around the orbital plane's z-axis (vault is the Uranus-style sideways one) */
  axialTilt: number;
  /** rad/s — giants spin fastest, like the real ones */
  spinSpeed: number;
  /** surface palette, dark → light, plus a detail color (cracks, storms, lava) */
  palette: { base: string; low: string; high: string; detail: string };
  /** fresnel rim tint — this is where the room accent lives */
  atmosphere: { color: string; opacity: number };
  /** absolute scene units */
  ring?: { inner: number; outer: number; opacity: number };
  /** emissive night-side speckle color (terra only) */
  cityLights?: string;
}

export const PLANET_CONFIGS: Record<string, PlanetConfig> = {
  // The star. palette.base/high feed the corona tints.
  nexus: {
    kind: "sun",
    orbitRadius: 0,
    visualRadius: 3.0,
    axialTilt: 0,
    spinSpeed: 0,
    palette: { base: "#fff3d6", low: "#ffdf9e", high: "#e4e4e7", detail: "#ffb35c" },
    atmosphere: { color: "#ffdf9e", opacity: 0.8 },
  },
  // Innermost = hottest = the adversarial floor. Scorched Mercury-class rock.
  "roast-pit": {
    kind: "rock",
    orbitRadius: 10,
    visualRadius: 1.05,
    axialTilt: 0.06,
    spinSpeed: 0.05,
    palette: { base: "#2e211c", low: "#553526", high: "#8a5a3c", detail: "#e8622d" },
    atmosphere: { color: "#fb923c", opacity: 0.35 },
  },
  // Commerce = civilization: the inhabited world, in the habitable-zone slot.
  bazaar: {
    kind: "terra",
    orbitRadius: 15.5,
    visualRadius: 1.3,
    axialTilt: 0.41,
    spinSpeed: 0.06,
    palette: { base: "#0d2f52", low: "#1a5078", high: "#7d6f45", detail: "#44603a" },
    atmosphere: { color: "#fbbf24", opacity: 0.4 },
    cityLights: "#fbbf24",
  },
  // Stress-testing = the cracked ice shell. Europa-class.
  "simulation-sandbox": {
    kind: "cracked-ice",
    orbitRadius: 20.5,
    visualRadius: 1.0,
    axialTilt: 0.1,
    spinSpeed: 0.04,
    palette: { base: "#8ba3b5", low: "#a7bdcc", high: "#e2ebf1", detail: "#3b7ea8" },
    atmosphere: { color: "#38bdf8", opacity: 0.32 },
  },
  // The archive keeps rings of records. Saturn-class banded giant.
  "intellectual-hub": {
    kind: "banded-giant",
    orbitRadius: 27,
    visualRadius: 2.1,
    axialTilt: 0.47,
    spinSpeed: 0.14,
    palette: { base: "#5c5178", low: "#7d719c", high: "#b9adcf", detail: "#453b60" },
    atmosphere: { color: "#a78bfa", opacity: 0.35 },
    ring: { inner: 2.7, outer: 3.9, opacity: 0.85 },
  },
  // Macro signals from a smooth, sideways world. Uranus-class: ~90° tilt, faint ring.
  "macro-vault": {
    kind: "smooth-giant",
    orbitRadius: 33.5,
    visualRadius: 1.7,
    axialTilt: 1.62,
    spinSpeed: 0.1,
    palette: { base: "#25705f", low: "#35917b", high: "#8fd9c9", detail: "#1d5a4e" },
    atmosphere: { color: "#34d399", opacity: 0.32 },
    ring: { inner: 2.35, outer: 2.65, opacity: 0.3 },
  },
  // Iteration storms until convergence. Neptune-class storm giant, outermost.
  "iteration-forge": {
    kind: "storm-giant",
    orbitRadius: 40,
    visualRadius: 1.8,
    axialTilt: 0.49,
    spinSpeed: 0.12,
    palette: { base: "#10307a", low: "#1c4aa5", high: "#5b93dd", detail: "#0a1e52" },
    atmosphere: { color: "#22d3ee", opacity: 0.36 },
  },
};

const FALLBACK = PLANET_CONFIGS["roast-pit"];

export function planetFor(theme: string): PlanetConfig {
  return PLANET_CONFIGS[theme] ?? FALLBACK;
}

/** Belt sits in the sandbox→hub gap — the same slot the real belt occupies. */
export const BELT = { inner: 22.6, outer: 25.4, ySpread: 0.55 };

/** Shared vertical anchor: planet centers sit here (CameraRig looks at y=1.5). */
export const ECLIPTIC_Y = 1.6;
