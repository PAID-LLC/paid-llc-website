"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { surface, triplanarMaterial, type SurfaceSpec } from "@/components/v2/latent/surface-kit";

// ── Palimpsest surfaces ──────────────────────────────────────────────────────
//
// Until this pass the whole world was flat-shaded colour: no textures, no
// environment map, so every object read as a solid shape rather than a thing
// made of something. That is the single biggest reason a world looks like a
// diagram, and it is worse here than anywhere else in the portfolio, because
// this world's subject is a written surface. A palimpsest with no surface
// detail is a contradiction.
//
// Three materials, deliberately few — the world is dust, cut stone, and older
// cut stone, and inventing more would only cost draw calls.
//
// Every spec is tuned for a NIGHT world lit mostly by lamps: `wet` stays low
// because there is little to reflect beyond the moon and the lamps, and `rough`
// stays high so the amber lamplight scatters instead of specularing.

/** The dune sea. Windblown, uniform, almost no seams — dust has no courses. */
const DUST: SurfaceSpec = {
  stain: "#2a2114",
  panelsX: 1,
  panelsY: 1,
  seam: 0.04,
  wear: 0.85,
  wet: 0,
  rough: 0.98,
  relief: 0.5,
};

/** Campus ashlar: cut, coursed, maintained. The seams are the point — regular
 *  horizontal courses are what separate a building from a boulder. */
const ASHLAR: SurfaceSpec = {
  stain: "#6f6046",
  panelsX: 4,
  panelsY: 6,
  seam: 0.42,
  wear: 0.34,
  wet: 0.06,
  rough: 0.86,
  relief: 0.9,
};

/** Precursor stone: the same rock, a thousand years less cared for. Heavier
 *  weathering, seams eroded rather than crisp. */
const RUIN: SurfaceSpec = {
  stain: "#4a3d2a",
  panelsX: 3,
  panelsY: 3,
  seam: 0.22,
  wear: 0.82,
  wet: 0,
  rough: 0.96,
  relief: 1.1,
};

export interface PalimpsestSurfaces {
  dust: THREE.MeshStandardMaterial;
  /** Campus stone, for meshes carrying their own colour. */
  stone: THREE.MeshStandardMaterial;
  /** Campus stone for instanced detail: white, so per-instance colour shows. */
  stoneInstanced: THREE.MeshStandardMaterial;
  ruin: THREE.MeshStandardMaterial;
  /** The same stone still under the dust — darker, for buried tips and rubble. */
  ruinDark: THREE.MeshStandardMaterial;
}

/**
 * Built once and cached by the surface kit, so the canvas and the campus share
 * the same textures rather than generating two copies.
 *
 * `reduced` is the only dependency on purpose. Live numbers from the excavation
 * poll must never appear here: rebuilding a material swaps it underneath an
 * instanced mesh, which reconstructs it with an all-zero matrix buffer and
 * silently collapses every instance to scale zero. That failure cost the
 * Crucible its rim once already. A live value nudges a property in place.
 */
export function usePalimpsestSurfaces(reduced: boolean): PalimpsestSurfaces {
  const materials = useMemo<PalimpsestSurfaces>(() => {
    const dustS = surface("pal-dust", DUST);
    const ashlarS = surface("pal-ashlar", ASHLAR);
    const ruinS = surface("pal-ruin", RUIN);

    return {
      // Tiled coarse: the dune sea is 480x420, and a tight tile there turns to
      // moire long before it turns to sand.
      dust: triplanarMaterial({
        surface: dustS,
        color: "#3a2e1c",
        scale: 46,
        roughness: 0.98,
        metalness: 0.02,
        normalScale: 0.85,
        reduced,
      }),
      stone: triplanarMaterial({
        surface: ashlarS,
        color: "#8a7a5c",
        // ~4.5 world units per tile with 6 courses down: roughly 0.75-unit
        // courses on a body that stands 2.9. Reads as cut stone at walking
        // distance, which is where this world is actually viewed from.
        scale: 4.5,
        roughness: 0.86,
        metalness: 0.04,
        normalScale: 1,
        reduced,
      }),
      stoneInstanced: triplanarMaterial({
        surface: ashlarS,
        color: "#ffffff",
        scale: 4.5,
        roughness: 0.86,
        metalness: 0.04,
        normalScale: 1,
        vertexColors: true,
        reduced,
      }),
      ruin: triplanarMaterial({
        surface: ruinS,
        color: "#8a7a5c",
        scale: 3.2,
        roughness: 0.96,
        metalness: 0.02,
        normalScale: 1.15,
        reduced,
      }),
      ruinDark: triplanarMaterial({
        surface: ruinS,
        color: "#3f3421",
        scale: 3.2,
        roughness: 0.98,
        metalness: 0.02,
        normalScale: 1.15,
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
