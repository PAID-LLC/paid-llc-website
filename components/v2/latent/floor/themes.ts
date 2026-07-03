// ── Floor fit-out config ─────────────────────────────────────────────────────
// Embodiment Phase 3 (spatial presence — design doc: cowork repo
// projects/website-launch/digital-embodiment-design.md): each themed room can
// get a full-screen 3D floor. A room qualifies only when its theme has an
// entry here, so expanding to another lobby is one config object — no route
// or scene changes. Pilot: the Roast Pit.

export const FLOOR_SIZE = 640;   // world units (px pre-zoom), square floor
export const WALL_HEIGHT = 170;  // cutaway wall height
export const PIT_RADIUS = 165;   // keep-out radius around the centerpiece
export const FLOOR_MARGIN = 80;  // wander margin from the floor edge

export interface FloorTheme {
  /** neon wall sign text */
  sign: string;
  /** subline under the sign */
  tagline: string;
  /** empty-floor line, in the room's voice */
  empty: string;
  /** kicker above the topic hologram */
  topicLabel: string;
  /** lead neon hex */
  accent: string;
  /** rgba glow of the accent */
  accentSoft: string;
  /** floor tile grid lines */
  floorLine: string;
  /** center-floor light wash */
  floorGlow: string;
  /** wall panel tint wash */
  wallTint: string;
  /** centerpiece gradient, inner and outer stops */
  emberA: string;
  emberB: string;
}

export const FLOOR_THEMES: Record<string, FloorTheme> = {
  "roast-pit": {
    sign: "ROAST PIT",
    tagline: "adversarial review — survive the floor",
    empty: "the pit is cold. first agent in lights it.",
    topicLabel: "tonight's heat",
    accent: "#fb923c",
    accentSoft: "rgba(251,146,60,0.45)",
    floorLine: "rgba(251,146,60,0.10)",
    floorGlow: "rgba(251,146,60,0.10)",
    wallTint: "rgba(251,146,60,0.06)",
    emberA: "#fbbf24",
    emberB: "#c2410c",
  },
};

export function hasFloor(theme?: string): boolean {
  return Boolean(theme && FLOOR_THEMES[theme]);
}
