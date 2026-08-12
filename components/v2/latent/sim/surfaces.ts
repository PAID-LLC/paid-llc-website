"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { surface, triplanarMaterial, type SurfaceSpec } from "@/components/v2/latent/surface-kit";

// ── Substrate surfaces ───────────────────────────────────────────────────────
//
// The seventh of eight worlds to get a surface, and the first one whose ground
// is a real height field rather than a disc or a revolution. That changes the
// job: Arclight and the Lathe needed materials invented for them, Substrate
// already has terrain with genuine relief, terraces and a shoreline, all of it
// painted flat.
//
// Substrate is an OCEAN world. Every material decision below follows from that
// one fact rather than from a palette:
//
//   * Rock here is sea-worn, not quarried. Natural stone has no courses, so the
//     terrain spec carries no panel seams at all — see the note on PLAIN in
//     Meridian's surfaces.ts for what a panel grid does when it is stretched
//     across hundreds of units of open ground.
//   * Everything is wet. Not stylistically — it rains, it is a fog bank world
//     half the time, and the whole island sits in water. `wet` is high on both
//     specs, and unlike a wall this is horizontal-ish ground where the kit's
//     "pool in the dips" model is the correct one.
//   * The environment map is dark below the horizon, which is the exact
//     opposite of Waypoint's. Deep water has an albedo around 0.06 — it is one
//     of the darkest surfaces there is. A bright bounce here would be a lie and
//     would also flatten the terraces the shadow pass exists to carve.

/**
 * The island itself. Wet volcanic slate.
 *
 * Seamless on purpose: `panelsX/Y` at 1 with `seam` 0 leaves only the fbm
 * mottle, which is what natural rock actually has. `wear` is then held low for
 * the non-obvious reason Meridian documented — the kit's weathering is a DRIP
 * that peaks below each horizontal seam, so with one seam per tile a high wear
 * smears a single streak across the whole landscape and reads as a trench.
 */
const BASALT: SurfaceSpec = {
  stain: "#3f5a63", // sea-salt and algae bloom, not rust
  panelsX: 1,
  panelsY: 1,
  seam: 0,
  wear: 0.24,
  wet: 0.55,
  rough: 0.9,
  relief: 0.55,
};

/**
 * Everything the cast has raised: shelters, cairns, beacons, garden walls.
 *
 * This is the one place Substrate's material story admits a second voice.
 * Structures are WORKED stone — cut, stacked and coursed — so they take the
 * panel seams the terrain refuses. That contrast is the point: it is how a
 * viewer tells at a glance which rock the world made and which rock the agents
 * made, without a label. On a world whose entire premise is that its
 * inhabitants build things, that distinction is worth more than any amount of
 * extra detail on either surface alone.
 */
const WORKED: SurfaceSpec = {
  stain: "#4a6570",
  panelsX: 3,
  panelsY: 4,
  seam: 0.45,
  wear: 0.5,
  wet: 0.3,
  rough: 0.86,
  relief: 1,
};

// World units per tile. The terrain runs 300 across with terraces and mesas in
// the 20-40 unit range, so a 26-unit tile puts roughly a dozen across the map
// while the spec's own 26-cycle octave supplies grain at about a unit — fine
// enough to read from the descent camera, coarse enough not to shimmer.
//
// Structures are 1-5 units, so they need a tile an order of magnitude tighter
// or a whole cairn falls inside one texel of the terrain's tiling.
const TERRAIN_SCALE = 26;
const WORKED_SCALE = 3.4;

export interface SubstrateSurfaces {
  /** The island. Expects `vertexColors` geometry — see below. */
  terrain: THREE.MeshStandardMaterial;
  /** Shared structure material, cached per emissive intensity. */
  rock(emissiveIntensity: number): THREE.MeshStandardMaterial;
}

/**
 * Built once and cached; `reduced` is the only dependency, for the reason
 * written up on Palimpsest and Meridian — rebuilding a material swaps it
 * underneath an InstancedMesh, which rebuilds with an all-zero matrix buffer
 * and silently collapses every instance to scale zero. Weather, tick and agent
 * counts must never enter this array.
 */
export function useSubstrateSurfaces(reduced: boolean): SubstrateSurfaces {
  const built = useMemo(() => {
    const basaltS = surface("sub-basalt", BASALT);
    const workedS = surface("sub-worked", WORKED);

    const terrain = triplanarMaterial({
      surface: basaltS,
      // White, because the geometry's own vertex colours carry the real thing.
      // Those colours are not decoration: lib/sim-field.ts's groundColor()
      // paints the survey grid, the ridge lines and the shore band from the
      // same deterministic field the engine places agents on. Multiplying a
      // texture over them keeps every one of those signals intact and adds the
      // grain they were missing.
      color: "#ffffff",
      scale: TERRAIN_SCALE,
      roughness: 0.92,
      // Wet rock is not metal, but a little metalness is what lets the sky land
      // on the shore and the terrace tops. Inert before the environment map
      // existed; worth something now.
      metalness: 0.12,
      normalScale: 0.85,
      vertexColors: true,
      reduced,
    });

    // One material per distinct emissive intensity the structures ask for —
    // about six across the whole world, against 32 inline material declarations
    // before this. Cached rather than pre-enumerated so a new structure type
    // picking a new intensity costs nothing and needs no edit here.
    const rocks = new Map<number, THREE.MeshStandardMaterial>();
    const rock = (emissiveIntensity: number): THREE.MeshStandardMaterial => {
      const key = Math.round(emissiveIntensity * 100) / 100;
      const existing = rocks.get(key);
      if (existing) return existing;
      const m = triplanarMaterial({
        surface: workedS,
        // Lifted from #141a24 (RGB 20,26,36). At that value a surface carries
        // no information for a light to reveal, which is why every previous
        // attempt to improve these worlds by adding lights did so little.
        color: "#2b3547",
        scale: WORKED_SCALE,
        roughness: 0.86,
        metalness: 0.1,
        emissive: "#38bdf8",
        emissiveIntensity: key,
        normalScale: 1,
        reduced,
      });
      // Kept faceted deliberately. On the terrain, flat shading fights a normal
      // map and loses; here the geometry IS icosahedra and short prisms, and
      // the faceting is the shape language that says "stacked stone". The
      // texture supplies grain within each facet rather than replacing it.
      m.flatShading = true;
      rocks.set(key, m);
      return m;
    };

    return { terrain, rock, rocks };
  }, [reduced]);

  useEffect(
    () => () => {
      built.terrain.dispose();
      for (const m of built.rocks.values()) m.dispose();
    },
    [built]
  );

  return built;
}
