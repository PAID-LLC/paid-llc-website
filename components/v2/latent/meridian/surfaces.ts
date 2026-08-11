"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { surface, triplanarMaterial, type SurfaceSpec } from "@/components/v2/latent/surface-kit";
import { STOREY } from "@/lib/meridian/skyline";
import type { Ward } from "@/lib/meridian/engine";

// ── Meridian surfaces ────────────────────────────────────────────────────────
//
// The portfolio's one DAYLIGHT world, which changes the recipe rather than just
// the palette.
//
// On a night world the environment map is a nicety: most of what you see is lit
// by lamps you can point at. Here it is the whole lighting model. Meridian's
// material story is glass — six wards of it — and glass shows you the sky or it
// shows you nothing. Before this pass the scene had no environment map at all,
// so every pane was a flat pastel rectangle with a specular dot on it. That is
// the single worst case for PBR there is: high metalness and low roughness with
// nothing to reflect renders darker and deader than plain matte paint.
//
// The other daylight-specific decision is that NOTHING here uses the surface
// kit's emissive window grid. Lit windows are a night cue; at noon a window is
// darker than the wall around it, not brighter. The grid instead comes from the
// panel seams, which cut the shared height field and therefore land in the
// albedo, the normal map and the roughness map at once — recessed, shaded and
// slightly rougher, exactly like a real mullion.

/**
 * Curtain wall, for the two glass wards.
 *
 * `wet` is deliberately 0 despite this being the shiniest surface in the world.
 * The kit pools wetness in the height field's DIPS, which on a wall are the
 * seams — so a high `wet` would polish the mullions and leave the panes matte,
 * precisely inverting a curtain wall. Glazing gets its smoothness from the
 * material's roughness scalar instead, where it belongs.
 */
const CURTAIN: SurfaceSpec = {
  stain: "#8c9bab",
  panelsX: 5,
  panelsY: 7,
  seam: 0.5,
  wear: 0.12, // a maintained city, not a ruin — this is Palimpsest's opposite
  wet: 0,
  rough: 0.22,
  relief: 0.35, // mullions stand a few centimetres proud, no more
};

/** Cut stone for the civic halls, plinths and the low wards. Monumental ashlar:
 *  coursed, clean, and matte enough to hold the daylight without flaring. */
const CIVIC: SurfaceSpec = {
  stain: "#7d6f52",
  panelsX: 3,
  panelsY: 6,
  seam: 0.3,
  wear: 0.2,
  wet: 0.05,
  rough: 0.72,
  relief: 0.8,
};

/** The paved plaza. The one surface where `wet` means what it says — this is a
 *  horizontal slab, so pooling in the dips is correct rather than inverted. */
const PLAZA: SurfaceSpec = {
  stain: "#8a7f61",
  panelsX: 6,
  panelsY: 6,
  seam: 0.35,
  wear: 0.3,
  wet: 0.12,
  rough: 0.8,
  relief: 0.55,
};

/**
 * Open country. Seamless on purpose: the first attempt reused PLAZA out to the
 * horizon, and a 6x6 panel grid stretched over 2300 units turned the whole
 * landscape into a chequerboard of 43-unit slabs. Ground outside a city has no
 * courses — only mottling.
 */
// `wear` is kept low for a second, less obvious reason. The kit's weathering is
// a DRIP: it peaks just under each horizontal seam and fades downward, which is
// right on a wall and meaningless on a field. With panelsY at 1 there is only
// one seam per tile, so a high wear stretched a single streak across 150 units
// of ground and read as a trench gouged out of the landscape. Mottling here has
// to come from the broad grime term instead.
const PLAIN: SurfaceSpec = {
  stain: "#5f5a37",
  panelsX: 1,
  panelsY: 1,
  seam: 0,
  wear: 0.22,
  wet: 0,
  rough: 0.97,
  relief: 0.18,
};

// Tile sizes are set from STOREY so the facades agree with the massing they sit
// on. Because triplanar sampling uses world Y as a wall's second coordinate,
// floor bands line up at the same absolute heights across every building in the
// city for free — which is what stops a skyline reading as unrelated boxes.
const CURTAIN_SCALE = STOREY * 7; // 7 rows per tile → one row per storey
const CIVIC_SCALE = STOREY * 3; // 6 courses per tile → two courses per storey
const PLAZA_SCALE = 40; // ~3 m paving slabs

/** Which wards are glass. The rest are masonry. */
const GLASS_WARDS: ReadonlySet<Ward> = new Set<Ward>(["spire_row", "ledger_house"]);

export function isGlassWard(ward: Ward): boolean {
  return GLASS_WARDS.has(ward);
}

export interface MeridianSurfaces {
  /** The open country the city stands in, running out to the fog. */
  plain: THREE.MeshStandardMaterial;
  /** The paved ground disc. */
  plaza: THREE.MeshStandardMaterial;
  /** Civic stone, for the Agora plinth and the ward landmarks. */
  civic: THREE.MeshStandardMaterial;
  /** One body material per ward, already carrying that ward's tint. */
  body: Record<Ward, THREE.MeshStandardMaterial>;
  /** The glazed roof band every building wears. */
  cap: THREE.MeshStandardMaterial;
  capWarm: THREE.MeshStandardMaterial;
}

const WARD_TINT: Record<Ward, string> = {
  spire_row: "#dbe7f5",
  ledger_house: "#e4ded0",
  archive: "#f2e9d6",
  atelier: "#f3c9c9",
  yards: "#d8ddd0",
  commons: "#cdeccf",
};

const WARDS_ALL = Object.keys(WARD_TINT) as Ward[];

/**
 * Built once and cached by the surface kit.
 *
 * `reduced` is the only dependency, for the reason written up on Palimpsest:
 * rebuilding a material swaps it underneath an instanced mesh, which rebuilds
 * with an all-zero matrix buffer and silently collapses every instance to scale
 * zero. Live values — the prosperity index, ward levels — must nudge a property
 * in place, never re-enter this hook's dependency array.
 *
 * Sharing per-ward materials also cuts Meridian from ~102 material compiles
 * (two per building, created inline in JSX) to ten.
 */
export function useMeridianSurfaces(reduced: boolean): MeridianSurfaces {
  const materials = useMemo<MeridianSurfaces>(() => {
    const curtainS = surface("mer-curtain", CURTAIN);
    const civicS = surface("mer-civic", CIVIC);
    const plazaS = surface("mer-plaza", PLAZA);
    const plainS = surface("mer-plain", PLAIN);

    const body = Object.fromEntries(
      WARDS_ALL.map((w) => {
        const glass = GLASS_WARDS.has(w);
        return [
          w,
          triplanarMaterial({
            surface: glass ? curtainS : civicS,
            color: WARD_TINT[w],
            scale: glass ? CURTAIN_SCALE : CIVIC_SCALE,
            // Glass is smooth and half-metallic so the sky actually lands on
            // it. Masonry stays matte; a shiny civic hall reads as plastic.
            roughness: glass ? 0.22 : 0.74,
            metalness: glass ? 0.35 : 0.05,
            normalScale: glass ? 0.7 : 1,
            reduced,
          }),
        ];
      })
    ) as Record<Ward, THREE.MeshStandardMaterial>;

    return {
      // Tiled coarse but not enormous — with no seams there is no grid to give
      // the repeat away, so this can stay tight enough to read as ground.
      // Deliberately darker and greener than the city it surrounds: a cream
      // plaza on cream country has no silhouette, and the whole point of the
      // landscape is to put the city in relief against something.
      plain: triplanarMaterial({
        surface: plainS,
        color: "#9aa06d",
        scale: 190,
        roughness: 0.97,
        metalness: 0,
        normalScale: 0.35,
        reduced,
      }),
      plaza: triplanarMaterial({
        surface: plazaS,
        color: "#ddd4bb",
        scale: PLAZA_SCALE,
        roughness: 0.82,
        metalness: 0.03,
        normalScale: 0.9,
        reduced,
      }),
      civic: triplanarMaterial({
        surface: civicS,
        color: "#ede7d6",
        scale: CIVIC_SCALE,
        roughness: 0.7,
        metalness: 0.05,
        normalScale: 1,
        reduced,
      }),
      body,
      cap: triplanarMaterial({
        surface: curtainS,
        color: "#e8f0ec",
        scale: CURTAIN_SCALE,
        roughness: 0.16,
        metalness: 0.5,
        normalScale: 0.5,
        reduced,
      }),
      capWarm: triplanarMaterial({
        surface: curtainS,
        color: "#fff4dc",
        scale: CURTAIN_SCALE,
        roughness: 0.18,
        metalness: 0.45,
        normalScale: 0.5,
        reduced,
      }),
    };
  }, [reduced]);

  useEffect(
    () => () => {
      const { body, ...rest } = materials;
      for (const m of Object.values(rest)) m.dispose();
      for (const m of Object.values(body)) m.dispose();
    },
    [materials]
  );

  return materials;
}
