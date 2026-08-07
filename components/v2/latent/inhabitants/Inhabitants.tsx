"use client";

import { useMemo } from "react";
import { PLACEMENT, type InhabitedWorld } from "@/lib/inhabitants/placement";
import { useInhabitants } from "./useInhabitants";
import Inhabitant from "./Inhabitant";

// ── Everyone standing on this world right now ────────────────────────────────
//
// One line per scene: `<Inhabitants world="crucible" reduced={reduced} />`,
// mounted inside the world's existing <Canvas>. Purely additive — it renders
// nothing at all until there is somebody real to render, so a world whose
// residents table has not been migrated and whose room is empty looks exactly
// as it did before this shipped. That is the intended failure mode.
//
// Worlds with terrain pass their own height sampler so figures stand on the
// ground instead of hovering over it. Keeping the sampler at the call site
// means Palimpsest's dune field stays out of the other five worlds' bundles.

export default function Inhabitants({
  world,
  reduced,
  groundY,
}: {
  world: InhabitedWorld;
  reduced: boolean;
  groundY?: (x: number, z: number) => number;
}) {
  const place = PLACEMENT[world];
  const people = useInhabitants(world);
  const sample = useMemo(
    () => groundY ?? (() => place.baseY),
    [groundY, place.baseY]
  );

  if (people.length === 0) return null;

  return (
    <>
      {people.map((p) => (
        <Inhabitant
          key={p.id}
          data={p}
          groundY={sample}
          scale={place.figure}
          bright={place.bright}
          reduced={reduced}
        />
      ))}
    </>
  );
}
