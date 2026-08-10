"use client";

import { useMemo } from "react";
import { GroundMist, ParticleField, StormFlash } from "@/components/v2/latent/ground-fx";
import { PLACEMENT, type InhabitedWorld } from "@/lib/inhabitants/placement";
import WorldAudio from "@/components/v2/latent/audio/WorldAudio";
import { useSceneSpeech } from "@/components/v2/latent/audio/useSceneSpeech";
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
  intensity = 0,
}: {
  world: InhabitedWorld;
  reduced: boolean;
  groundY?: (x: number, z: number) => number;
  /** 0..1 off this world's own live snapshot, passed straight through to its
   *  audio bed. The canvas already holds that state; routing it here keeps the
   *  sound and the scene reading the same numbers by construction. */
  intensity?: number;
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

  // Voices for lines that arrive while you are listening, and a replay handler
  // for the ones already on screen. Both no-op until the visitor turns sound on.
  const replay = useSceneSpeech(world, people, reduced);

  // Memoised by value, not by identity: the sky object is rebuilt on every
  // poll even when the weather has not changed, and an unstable prop here
  // would re-ramp the wind on every render.
  const hasSky = !!sky;
  const severity = sky?.weather.severity ?? 0;
  const particles = sky?.weather.fx.particles ?? null;
  const flash = sky?.weather.fx.flash ?? false;
  const weather = useMemo(
    () => (hasSky ? { severity, particles, flash } : null),
    [hasSky, severity, particles, flash]
  );

  // Deliberately outside the early return below: the bed is this world's own
  // reading of itself and does not depend on anybody standing in it. An empty
  // world still sounds like the place it is.
  const audio = (
    <WorldAudio surface={world} intensity={intensity} weather={weather} />
  );

  if (people.length === 0 && !sky) return audio;

  return (
    <>
      {audio}
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
          onReplay={p.says ? () => replay(p.name, p.says!, p.x, p.z) : undefined}
        />
      ))}
    </>
  );
}
