/**
 * Tests for lib/audio/mixer.ts and lib/audio/worlds.ts — the settings and the
 * per-surface voicing.
 *
 * The mixer half is defensive-parsing territory: whatever is in localStorage
 * arrives untyped and possibly written by an older schema or by hand, and the
 * failure mode of an audio setting must always be QUIETER, never louder.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_MASTER,
  DEFAULT_WORLD,
  clamp01,
  effectiveGain,
  parseSettings,
  serialiseSettings,
  worldGain,
  type AudioSettings,
} from "@/lib/audio/mixer";
import {
  ROOM_SURFACE,
  SURFACES,
  SURFACE_LABEL,
  SURFACE_VOICE,
  bedAt,
  normalise,
  surfaceFor,
} from "@/lib/audio/worlds";

const on: AudioSettings = { enabled: true, master: 1, worlds: {} };

describe("parseSettings", () => {
  it("defaults to silence with nothing stored", () => {
    // The single most important assertion in this file. Sound is opt-in: WCAG
    // 1.4.2 is cleared outright by never playing automatically, and a browser
    // builds a context outside a user gesture in the suspended state anyway.
    expect(parseSettings(null).enabled).toBe(false);
    expect(parseSettings("").enabled).toBe(false);
  });

  it("survives anything at all in the slot", () => {
    for (const junk of [
      "not json",
      "[]",
      "null",
      "42",
      '"a string"',
      "{",
      '{"enabled":',
      '{"worlds":"nope"}',
      '{"worlds":[1,2,3]}',
    ]) {
      const s = parseSettings(junk);
      expect(s.enabled).toBe(false);
      expect(s.master).toBe(DEFAULT_MASTER);
      expect(s.worlds).toEqual({});
    }
  });

  it("treats anything but a literal true as off", () => {
    // "1", 1 and "true" all mean somebody wrote this by hand or an old schema
    // leaked through. Quieter is the safe reading.
    for (const v of ['"true"', "1", '"1"', "null"]) {
      expect(parseSettings(`{"enabled":${v}}`).enabled).toBe(false);
    }
    expect(parseSettings('{"enabled":true}').enabled).toBe(true);
  });

  it("clamps out-of-range and non-finite levels instead of trusting them", () => {
    expect(parseSettings('{"master":9}').master).toBe(1);
    expect(parseSettings('{"master":-4}').master).toBe(0);
    expect(parseSettings('{"master":"loud"}').master).toBe(DEFAULT_MASTER);
    const w = parseSettings('{"worlds":{"crucible":40,"lathe":-2,"x":"y"}}').worlds;
    expect(w.crucible).toBe(1);
    expect(w.lathe).toBe(0);
    expect(w.x).toBeUndefined();
  });

  it("round-trips a real settings object", () => {
    const s: AudioSettings = { enabled: true, master: 0.42, worlds: { crucible: 0.3 } };
    expect(parseSettings(serialiseSettings(s))).toEqual(s);
  });
});

describe("clamp01", () => {
  it("maps every non-number to silence", () => {
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(0);
    expect(clamp01(-Infinity)).toBe(0);
  });
});

describe("gains", () => {
  it("gives an untouched surface a real level, not silence", () => {
    // A world that ships after the visitor last opened the mixer must be
    // audible rather than mysteriously mute.
    expect(worldGain(on, "waypoint")).toBe(DEFAULT_WORLD);
  });

  it("makes mute exactly zero, whatever the sliders say", () => {
    // A slider left at 1% must not leak past a mute.
    const s: AudioSettings = { enabled: false, master: 1, worlds: { crucible: 1 } };
    expect(effectiveGain(s, "crucible")).toBe(0);
  });

  it("multiplies the world trim by the universe level", () => {
    const s: AudioSettings = { enabled: true, master: 0.5, worlds: { crucible: 0.5 } };
    expect(effectiveGain(s, "crucible")).toBeCloseTo(0.25, 9);
  });
});

describe("surfaceFor", () => {
  it("maps every immersive route SiteChrome knows about", () => {
    expect(surfaceFor("/the-latent-space")).toBe("universe");
    expect(surfaceFor("/the-latent-space/crucible")).toBe("crucible");
    expect(surfaceFor("/the-latent-space/lathe")).toBe("lathe");
    expect(surfaceFor("/the-latent-space/arclight")).toBe("arclight");
    expect(surfaceFor("/the-latent-space/palimpsest")).toBe("palimpsest");
    expect(surfaceFor("/the-latent-space/meridian")).toBe("meridian");
    expect(surfaceFor("/the-latent-space/waypoint")).toBe("waypoint");
    expect(surfaceFor("/the-latent-space/simulation")).toBe("simulation");
    expect(surfaceFor("/the-latent-space/genesis/world")).toBe("genesis");
    expect(surfaceFor("/v2/lobbies/3/floor")).toBe("lounge");
  });

  it("gives no bed to a page that is not a world", () => {
    for (const p of [
      "/",
      "/the-latent-space/registry",
      "/the-latent-space/bazaar",
      "/the-latent-space/genesis",
      "/v2/lobbies",
      "/the-latent-space/universe",
      "/the-latent-space/lounge",
      "/blog/some-post",
    ]) {
      expect(surfaceFor(p), p).toBeNull();
    }
  });
});

describe("the voicing table", () => {
  it("covers every surface, with a label and a stated driver", () => {
    for (const s of SURFACES) {
      expect(SURFACE_VOICE[s], s).toBeTruthy();
      expect(SURFACE_LABEL[s], s).toBeTruthy();
      // The mixer shows this string. An empty one would be a control whose
      // effect the visitor cannot account for.
      expect(SURFACE_VOICE[s].driver.length, s).toBeGreaterThan(3);
    }
  });

  it("gives every one of the eight worlds its own note in the chord", () => {
    // The universe chord sounds all eight at once. Two worlds on the same
    // pitch cannot be told apart, which defeats the point of the chord —
    // Arclight and Substrate both sat on 110 in the first pass.
    const keys = Object.values(ROOM_SURFACE).map((s) => SURFACE_VOICE[s].key);
    expect(new Set(keys).size).toBe(8);
  });

  it("maps every lounge room to a world", () => {
    for (let room = 1; room <= 8; room++) {
      expect(ROOM_SURFACE[room], `room ${room}`).toBeTruthy();
    }
    expect(new Set(Object.values(ROOM_SURFACE)).size).toBe(8);
  });
});

describe("bedAt", () => {
  it("never falls silent, even at zero activity", () => {
    // Same decision lavaLevel makes when the forge goes cold: a floor of zero
    // renders "nothing happened today" as "this world is broken".
    for (const s of SURFACES) {
      const p = bedAt(SURFACE_VOICE[s], 0);
      expect(p.droneGain, s).toBeGreaterThan(0);
      expect(p.airGain, s).toBeGreaterThan(0);
    }
  });

  it("is louder when the world is busier", () => {
    for (const s of SURFACES) {
      const quiet = bedAt(SURFACE_VOICE[s], 0);
      const busy = bedAt(SURFACE_VOICE[s], 1);
      expect(busy.droneGain, s).toBeGreaterThan(quiet.droneGain);
      expect(busy.airBand, s).toBeGreaterThan(quiet.airBand);
      expect(busy.tickRate, s).toBeGreaterThanOrEqual(quiet.tickRate);
    }
  });

  it("stops ticking entirely when nothing is happening", () => {
    // Sparks and hull knocks are events. No activity, no events.
    for (const s of SURFACES) {
      expect(bedAt(SURFACE_VOICE[s], 0).tickRate, s).toBe(0);
    }
  });

  it("survives a broken intensity rather than emitting NaN into an AudioParam", () => {
    // setTargetAtTime(NaN) throws and takes the whole bed down with it, so a
    // bad number upstream must never reach the engine.
    for (const bad of [NaN, Infinity, -Infinity, -5, 12]) {
      for (const s of SURFACES) {
        for (const [k, v] of Object.entries(bedAt(SURFACE_VOICE[s], bad))) {
          expect(Number.isFinite(v), `${s}.${k} at ${bad}`).toBe(true);
          expect(v, `${s}.${k} at ${bad}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("keeps every level inside a sane range at full tilt", () => {
    for (const s of SURFACES) {
      const p = bedAt(SURFACE_VOICE[s], 1);
      expect(p.droneGain, s).toBeLessThan(0.8);
      expect(p.airGain, s).toBeLessThan(0.8);
      expect(p.tickGain, s).toBeLessThan(0.4);
      expect(p.airBand, s).toBeLessThan(20000);
    }
  });
});

describe("normalise", () => {
  it("reads zero as zero", () => {
    expect(normalise(0, 10)).toBe(0);
    expect(normalise(-3, 10)).toBe(0);
    expect(normalise(NaN, 10)).toBe(0);
  });

  it("spends most of its range on the counts this platform actually sees", () => {
    // Logarithmic on purpose. Linear against a soft cap of 60 would round every
    // real reading in this business's history to silence: 1 registered agent
    // would be 1.7%.
    expect(normalise(1, 60)).toBeGreaterThan(0.15);
    expect(normalise(4, 60)).toBeGreaterThan(0.35);
    expect(normalise(60, 60)).toBeCloseTo(1, 6);
  });

  it("clamps past the soft cap instead of running away", () => {
    expect(normalise(10_000, 60)).toBe(1);
  });
});
