"use client";

import Planet from "./Planet";
import Sun from "./Sun";
import { planetFor } from "./planet-config";
import type { GenesisSurface } from "./planet-textures";

// ── World shell ──────────────────────────────────────────────────────────────
// Universe-scale body for each themed room. The old map-scale dioramas
// (firepit, market stall, obelisk...) lived here until 2026-07-10; they're in
// git history. The universe now reads as an actual star system — the Nexus is
// the star, every other room is a planet archetype defined in
// planet-config.ts — while the rooms' interiors (floors, lobbies) keep their
// own architecture untouched.

export default function WorldShell({
  themeKey,
  active,
  genesis,
  activity = 0,
}: {
  themeKey: string;
  active: boolean;
  genesis?: GenesisSurface;
  /** room's live 0-1 activity level — see lib/room-activity.ts */
  activity?: number;
}) {
  const config = planetFor(themeKey);
  if (config.kind === "sun") return <Sun config={config} activity={activity} />;
  return <Planet themeKey={themeKey} config={config} active={active} genesis={genesis} activity={activity} />;
}
