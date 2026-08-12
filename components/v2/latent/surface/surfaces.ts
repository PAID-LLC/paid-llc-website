"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { surface, triplanarMaterial, type SurfaceSpec } from "@/components/v2/latent/surface-kit";

// ── Genesis surfaces ─────────────────────────────────────────────────────────
//
// The last of the eight worlds to get a surface, and the only one where the
// surface is not a constant.
//
// Every other world in the portfolio has fixed ground. Arclight's concrete is
// concrete; the Crucible's sand is sand. Synthetica Prime's ground is being
// deliberately CHANGED — the assembly votes a terraform direction, the stage
// climbs from 0 to 5, and lib/../surface-field.ts's groundColor() already
// repaints the territory as it goes. Until now that progression was visible
// only as hue: the same dead matte rock, tinted green or blue.
//
// So the material tracks the stage too, and it does it the honest way — through
// the physical properties that actually change when a world comes alive.
// Terraforming is, in the end, the arrival of water and life on bare rock, and
// what that does to a surface is make it SMOOTHER and more reflective. Dry
// regolith is the roughest natural material there is. Wet stone, moss, ice and
// standing water are all far less rough. So `roughness` falls and `metalness`
// rises as the stage climbs, and the environment map — which did not exist
// before this pass — is what turns that into something you can see.
//
// One texture set covers all six stages. The wetness is carried by the
// material's roughness scalar rather than baked into the roughness map, because
// the kit multiplies the two (`roughnessFactor = roughness * map.g`). That means
// the stage can be dialled in place on a live material instead of regenerating
// textures every time a ballot lands — which matters, because rebuilding a
// material swaps it underneath any InstancedMesh using it and silently
// collapses every instance to scale zero.

/**
 * Bare regolith. The state the world starts in and never entirely leaves.
 *
 * Seamless: natural ground has no courses, and a panel grid stretched over 260
 * units turns a landscape into a chequerboard — the mistake Meridian documented
 * after trying it. `wear` is held low for the same reason it is there: the
 * kit's weathering is a drip that peaks under each horizontal seam, so with one
 * seam per tile a high value smears a single streak across the whole map.
 *
 * `wet` is 0 in the texture and stays 0 at every stage. Pooling belongs in the
 * dips of a height field, and this map is sampled triplanar across cliffs,
 * mesas and flats alike — the stage-driven sheen goes on the material instead,
 * where it applies evenly and can be changed without regenerating anything.
 */
const REGOLITH: SurfaceSpec = {
  stain: "#6b4a52", // iron dust, matching the world's rose accent at low saturation
  panelsX: 1,
  panelsY: 1,
  seam: 0,
  wear: 0.2,
  wet: 0,
  rough: 0.95,
  relief: 0.6,
};

/**
 * Everything the assembly has raised.
 *
 * Coursed and seamed where the ground is not. On Substrate that contrast
 * separates rock the world made from rock the agents made; here it carries more
 * than that, because on Synthetica Prime nothing gets built without a ballot
 * passing first. Every seam on this surface is downstream of a vote.
 */
const RAISED: SurfaceSpec = {
  stain: "#6d4f5c",
  panelsX: 3,
  panelsY: 5,
  seam: 0.48,
  wear: 0.4,
  wet: 0.1,
  rough: 0.84,
  relief: 1,
};

// World units per tile. Ground runs 260 across with ridges and mesas in the
// 20-40 unit range; structures are 1-6 units and need a tile an order of
// magnitude tighter or a whole build lands inside one texel of the terrain's.
const TERRAIN_SCALE = 24;
const RAISED_SCALE = 3.2;

/**
 * How much the terraform direction changes the surface, beyond its colour.
 *
 * These are not four palettes — the palette is already handled by
 * surface-field.ts's groundColor(), which paints the vertex colours this
 * material multiplies over. These are the four directions' PHYSICS, and they
 * differ because the four outcomes are genuinely different materials:
 *
 *   oceans      water, the smoothest and most reflective outcome there is
 *   crystalline mineral growth: hard, faceted, and the only metallic one
 *   verdant     vegetation, which is soft and scatters — barely reflective
 *   aurora      atmospheric, so the ground itself changes least of the four
 *
 * Read as: at full stage, multiply the dry roughness by `rough` and set
 * metalness to `metal`.
 */
const TERRAFORM_PHYSICS: Record<string, { rough: number; metal: number }> = {
  oceans: { rough: 0.34, metal: 0.3 },
  crystalline: { rough: 0.42, metal: 0.55 },
  verdant: { rough: 0.82, metal: 0.04 },
  aurora: { rough: 0.72, metal: 0.16 },
};

const DRY_ROUGHNESS = 0.96;

export interface GenesisSurfaces {
  /** The territory. Expects `vertexColors` geometry. */
  terrain: THREE.MeshStandardMaterial;
  /** Shared structure material, cached per emissive intensity. */
  rock(emissiveIntensity: number): THREE.MeshStandardMaterial;
}

/**
 * Materials are built once on `reduced` and then NUDGED by stage.
 *
 * The stage must not enter the dependency array. It changes whenever a ballot
 * enacts, which is exactly the live-data case that has to mutate a property in
 * place rather than swap the material — the trap written up on Palimpsest,
 * Meridian and Substrate.
 */
export function useGenesisSurfaces(
  reduced: boolean,
  stage: number,
  terraform: string | null
): GenesisSurfaces {
  const built = useMemo(() => {
    const regolithS = surface("gen-regolith", REGOLITH);
    const raisedS = surface("gen-raised", RAISED);

    const terrain = triplanarMaterial({
      surface: regolithS,
      // White: the geometry's vertex colours carry the real thing, and on this
      // world they are not decoration but the terraform record itself —
      // groundColor() paints coverage from the same deterministic field the
      // settlement lights and the planet's own texture read.
      color: "#ffffff",
      scale: TERRAIN_SCALE,
      roughness: DRY_ROUGHNESS,
      metalness: 0,
      normalScale: 0.9,
      vertexColors: true,
      reduced,
    });

    const rocks = new Map<number, THREE.MeshStandardMaterial>();
    const rock = (emissiveIntensity: number): THREE.MeshStandardMaterial => {
      const key = Math.round(emissiveIntensity * 100) / 100;
      const existing = rocks.get(key);
      if (existing) return existing;
      const m = triplanarMaterial({
        surface: raisedS,
        // Lifted from #241a20 (RGB 36,26,32), which is dark enough that no
        // light and no normal map could reveal anything on it.
        color: "#453039",
        scale: RAISED_SCALE,
        roughness: 0.84,
        metalness: 0.08,
        emissive: "#f472b6",
        emissiveIntensity: key,
        normalScale: 1,
        reduced,
      });
      // Faceting kept: the structures are icosahedra and short prisms and the
      // hard edges are the shape language. Only the terrain gives it up, where
      // a normal map strictly beats it.
      m.flatShading = true;
      rocks.set(key, m);
      return m;
    };

    return { terrain, rock, rocks };
  }, [reduced]);

  // The terraform response, applied in place. `stage / 5` is the same
  // progression coverageThreshold() uses, so the sheen arrives at the same rate
  // as the colour it belongs to rather than on a curve of its own.
  useEffect(() => {
    const t = Math.min(1, Math.max(0, stage / 5));
    const physics = TERRAFORM_PHYSICS[terraform ?? ""];
    const target = physics ?? { rough: DRY_ROUGHNESS, metal: 0 };
    built.terrain.roughness = DRY_ROUGHNESS + (target.rough - DRY_ROUGHNESS) * t;
    built.terrain.metalness = target.metal * t;
    built.terrain.needsUpdate = true;
  }, [built, stage, terraform]);

  useEffect(
    () => () => {
      built.terrain.dispose();
      for (const m of built.rocks.values()) m.dispose();
    },
    [built]
  );

  return built;
}
