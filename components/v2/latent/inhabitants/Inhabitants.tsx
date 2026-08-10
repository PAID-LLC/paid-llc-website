"use client";

import { useMemo } from "react";
import { GroundMist, ParticleField, StormFlash } from "@/components/v2/latent/ground-fx";
import { PLACEMENT, type InhabitedWorld } from "@/lib/inhabitants/placement";
import { useInhabitants, type Sky } from "./useInhabitants";
import Inhabitant from "./Inhabitant";

// ── Everyone standing on this world, under this world's sky ─────────────────
//
// One line per scene: `<Inhabitants world="crucible" reduced={reduced} />`,
// mounted inside the world's existing <Canvas>. It renders two things from a
// single fetch: the figures, and the weather over them.
//
// Weather lives here rather than in its own component so the scene and the
// engine can never disagree about the sky — both read the same snapshot, which
// derives it from (world, tick) in lib/residents/weather.ts.
//
// Purely additive — it renders nothing at all until there is somebody real to
// render, so a world whose residents table has not been migrated and whose
// room is empty looks exactly as it did before this shipped. That is the
// intended failure mode.
//
// Worlds with terrain pass their own height sampler so figures stand on the
// ground instead of hovering over it. Keeping the sampler at the call site
// means Palimpsest's dune field stays out of the other five worlds' bundles.

function WorldWeather({ sky, reduced }: { sky: Sky; reduced: boolean }) {
  const { fx } = sky.weather;
  return (
    <>
      {fx.mist > 0.02 ? (
        <GroundMist color={fx.tint} opacity={fx.mist} area={210} reduced={reduced} />
      ) : null}
      {fx.particles ? (
        <ParticleField mode={fx.particles} color={fx.tint} area={180} reduced={reduced} />
      ) : null}
      {fx.flash ? <StormFlash color={fx.tint} reduced={reduced} /> : null}
    </>
  );
}

/** How much of a world's roam spread a figure may stroll inside between ticks.
 *  Small on purpose: the tick position stays the anchor, so a scene read
 *  against the roster still agrees with it. Scaled by each world's own spread
 *  because Waypoint is a runway and Crucible is a circle — a fixed radius
 *  would walk the port crew off the tarmac. */
const LEASH = 0.22;

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
  const { people, sky } = useInhabitants(world);
  const sample = useMemo(
    () => groundY ?? (() => place.baseY),
    [groundY, place.baseY]
  );
  const leash = useMemo(
    () => ({ x: place.spread.x * LEASH, z: place.spread.z * LEASH }),
    [place.spread.x, place.spread.z]
  );

  if (people.length === 0 && !sky) return null;

  return (
    <>
      {sky ? <WorldWeather sky={sky} reduced={reduced} /> : null}
      {people.map((p) => (
        <Inhabitant
          key={p.id}
          data={p}
          groundY={sample}
          scale={place.figure}
          bright={place.bright}
          reduced={reduced}
          leash={leash}
        />
      ))}
    </>
  );
}
