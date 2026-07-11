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
}: {
  themeKey: string;
  active: boolean;
  genesis?: GenesisSurface;
}) {
  const config = planetFor(themeKey);
  if (config.kind === "sun") return <Sun config={config} />;
  return <Planet themeKey={themeKey} config={config} active={active} genesis={genesis} />;
}
