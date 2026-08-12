"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { surface, triplanarMaterial, type SurfaceSpec } from "@/components/v2/latent/surface-kit";

// ── Waypoint surfaces ────────────────────────────────────────────────────────
//
// The portfolio's one world with NO GROUND, which changes what a surface pass
// even means here.
//
// Every other world's materials are terrain and architecture: rock, stone,
// concrete, glass. Waypoint has none of that. It is a single built structure
// hanging in an amber cloud sea, so its entire material story is one thing —
// aerospace plate, weathering at altitude. Panel seams, rivet courses, oxide
// bleeding out of the fasteners, and condensation pooling in the low spots of a
// deck that spends its life inside cloud.
//
// Two decisions here are specific to this world and would be wrong anywhere
// else in the portfolio:
//
//   1. THE UNDERSTRUCTURE IS A HERO SURFACE, NOT BACKGROUND. Waypoint is the
//      only world whose OrbitControls open past the horizontal (maxPolarAngle
//      2.35), because dropping below the deck and looking up at it against open
//      sky is the best view in the portfolio. That makes the trusses and
//      mooring pylons camera-facing geometry. On any other world the
//      underside of the terrain is never seen and would be left untextured.
//
//   2. NO WINDOW GRIDS. The kit's emissive window map is the strongest "city"
//      cue it has, and four worlds use it. Waypoint is a port, not a city:
//      nobody lives here, they change craft here. A facade of lit apartments on
//      the control tower would assert a resident population the compiler has no
//      data for, and the honesty contract these worlds run under is that
//      geometry may only claim what the data supports.

/**
 * The deck plate and every horizontal walking surface.
 *
 * `wet` is the highest in the portfolio and that is not decoration. This is a
 * flat platform living permanently inside a cloud layer; standing water in the
 * low spots is the single most characteristic thing about its surface. The kit
 * pools wetness in the height field's dips, which on a horizontal slab is
 * exactly right (on a wall it would invert — see Meridian's CURTAIN note).
 */
const PLATE: SurfaceSpec = {
  stain: "#6d7385", // oxide bleeding from the fasteners, kept cool — see below
  // Four courses per tile, not seven. The first pass used seven at a 16-unit
  // tile, which put a seam every 2.3 units across a 90-unit deck: rendered, it
  // read as woven matting rather than as plate. Panel seams sell "built" only
  // while you can still count them.
  panelsX: 4,
  panelsY: 4,
  seam: 0.4,
  wear: 0.3,
  wet: 0.4,
  rough: 0.58,
  relief: 0.7,
};

/**
 * Structural steel: trusses, mooring pylons, jetway spines.
 *
 * Rougher, more worn and drier than the deck above it. Nothing pools on a
 * vertical member, and this is the part of the port that never gets cleaned
 * because reaching it means hanging under the platform over open cloud.
 */
const TRUSS: SurfaceSpec = {
  // Cool, like the plate. A warm stain here turned the pylons brown and the
  // whole platform read as a timber pier over a beach — which is a completely
  // different object from a structure hanging in the sky.
  stain: "#5f6779",
  panelsX: 3,
  panelsY: 6, // bolted sections, spaced so they stay countable
  seam: 0.5,
  wear: 0.5,
  wet: 0.08,
  rough: 0.82,
  relief: 0.95,
};

/**
 * The control tower and the docking pads — the maintained parts.
 *
 * Painted rather than bare, so the wear drops and the metalness rises. This is
 * the surface that carries the environment map most visibly: a half-metallic
 * curved shell in a bright amber sky picks up the horizon band as a rim down
 * its whole length, which is what separates the tower from the deck silhouette
 * without giving it its own light.
 */
const SHELL: SurfaceSpec = {
  stain: "#9a8365",
  panelsX: 6,
  panelsY: 5,
  seam: 0.4,
  wear: 0.24,
  wet: 0.12,
  rough: 0.44,
  relief: 0.5,
};

// World units per texture tile. The deck is 90 deep, so a 16-unit tile puts
// roughly five and a half plate courses across it — close to the real thing,
// where a deck plate is a couple of metres and the whole structure is a few
// hundred. The truss tile is tighter because the members are 2-3 units thick
// and a 16-unit tile would put a single seam on an entire pylon.
const PLATE_SCALE = 34;
const TRUSS_SCALE = 9;
const SHELL_SCALE = 13;

// ── The one rule this world's palette has to obey ────────────────────────────
//
// EVERYTHING BUILT HERE STAYS COOL. The sky, the sun, the cloud sea and the
// deck trim are all amber, and they fill most of the frame; a structure painted
// anywhere near that hue disappears into it. Rendered, the first pass did
// exactly that — warm stains under warm light gave a single orange wash with no
// silhouette anywhere in it.
//
// The fix is complementary contrast, not more detail. A blue-grey platform in
// an amber sky reads instantly at any distance, and it is also what the
// environment map wants: the cool metal picks up the warm sky as a rim, which
// only works while the two are different colours.

export interface WaypointSurfaces {
  /** The main deck plate and the Concourse spine. */
  deck: THREE.MeshStandardMaterial;
  /** Trusses and mooring pylons. White-based so per-instance tint carries. */
  truss: THREE.MeshStandardMaterial;
  /** Control tower shaft and cab. */
  tower: THREE.MeshStandardMaterial;
  /** Docking pads and jetways, in the gate's own colour at the call site. */
  pad: THREE.MeshStandardMaterial;
}

/**
 * Built once and cached by the surface kit; `reduced` is the only dependency.
 *
 * Rebuilding a material swaps it underneath an InstancedMesh, which rebuilds
 * with an all-zero matrix buffer and silently collapses every instance to scale
 * zero — the trap written up on Palimpsest and Meridian. Live values (traffic
 * level, arrivals) must nudge a property in place, never enter this array.
 */
export function useWaypointSurfaces(reduced: boolean): WaypointSurfaces {
  const materials = useMemo<WaypointSurfaces>(() => {
    const plateS = surface("way-plate", PLATE);
    const trussS = surface("way-truss", TRUSS);
    const shellS = surface("way-shell", SHELL);

    return {
      deck: triplanarMaterial({
        surface: plateS,
        color: "#333d55",
        scale: PLATE_SCALE,
        // Metalness matters here for the first time. Until the environment map
        // shipped, every metalness value in these worlds was inert — a metal
        // renders what it reflects, and there was nothing to reflect. The deck
        // now picks up the cloud sea, which is what makes the wet patches read
        // as wet rather than as dark paint.
        roughness: 0.6,
        metalness: 0.6,
        normalScale: 1,
        reduced,
      }),
      truss: triplanarMaterial({
        surface: trussS,
        // White: InstancedBlocks multiplies per-instance colour into this.
        color: "#ffffff",
        scale: TRUSS_SCALE,
        roughness: 0.84,
        metalness: 0.45,
        normalScale: 1.15,
        reduced,
      }),
      tower: triplanarMaterial({
        surface: shellS,
        color: "#3a4256",
        scale: SHELL_SCALE,
        roughness: 0.42,
        metalness: 0.6,
        // Amber, matching the deck trim, so the tower is lit by the port it
        // belongs to rather than glowing on its own account.
        emissive: "#ffb968",
        emissiveIntensity: 0.22,
        normalScale: 0.8,
        reduced,
      }),
      pad: triplanarMaterial({
        surface: plateS,
        color: "#2e3550",
        scale: PLATE_SCALE * 0.7,
        roughness: 0.55,
        metalness: 0.55,
        normalScale: 1,
        reduced,
      }),
    };
  }, [reduced]);

  useEffect(
    () => () => {
      for (const m of Object.values(materials)) m.dispose();
    },
    [materials]
  );

  return materials;
}
