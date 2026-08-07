/**
 * Tests for lib/inhabitants/placement.ts — the map from the residents'
 * abstract roam-space into each world's own 3D footprint.
 *
 * The engine works in one shared disc of ROAM_RADIUS about the origin; each
 * world is a different shape and a different size. Three properties matter:
 *
 *   1. CONTAINMENT — a resident anywhere in the roam disc lands inside the
 *      host world's usable ground. Waypoint is the sharp case: a 240-unit
 *      runway only about 90 units deep, so an isotropic mapping would walk
 *      the port crew off the tarmac and into the dark.
 *   2. STABILITY — a visiting agent's spot is derived from its name, so the
 *      60-second presence poll cannot teleport it around the ellipse, and a
 *      roster change cannot reshuffle everybody who did not move.
 *   3. SEPARATION — residents and visitors occupy different ground, so the
 *      two populations stay visually distinguishable no matter how the
 *      simulation moves.
 */

import { describe, it, expect } from "vitest";
import {
  INHABITED_WORLDS, PLACEMENT, RESIDENT_SCENES, VISITOR_MAX_AGE_MS,
  embodiable, hasResidents, hashName, toScene, visitorSpot,
  type InhabitedWorld,
} from "@/lib/inhabitants/placement";
import { ROAM_RADIUS, RESIDENT_WORLDS } from "@/lib/residents/cast";

/** Points on and inside the roam disc, including the extremes. */
function roamSamples(): [number, number][] {
  const pts: [number, number][] = [[0, 0]];
  for (let deg = 0; deg < 360; deg += 15) {
    const a = (deg * Math.PI) / 180;
    for (const r of [ROAM_RADIUS, ROAM_RADIUS * 0.5]) {
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }
  return pts;
}

/** Each world's usable ground, read off its own canvas/lib geometry. */
const BOUNDS: Record<InhabitedWorld, { x: number; z: number; note: string }> = {
  // Ground circle radius 230; the city occupies roughly the frame's 300x260.
  arclight: { x: 150, z: 130, note: "city frame, WORLD_SCALE 0.5 of 600x520" },
  // Arena floor is a radius-60 disc of sand.
  crucible: { x: 60, z: 60, note: "ARENA_FLOOR_RADIUS 60" },
  palimpsest: { x: 150, z: 130, note: "dig frame, WORLD_SCALE 0.5 of 600x520" },
  // Ground circle radius 220.
  lathe: { x: 220, z: 220, note: "GROUND_RADIUS 220" },
  // Tarmac plane is FRAME.w * 0.45 + 60 wide by 90 deep — so z is +/-45.
  waypoint: { x: 174, z: 45, note: "tarmac plane, 90 deep" },
  // Ground circle radius 95.
  meridian: { x: 95, z: 95, note: "ground circle radius 95" },
};

describe("world coverage", () => {
  it("places every resident world plus Meridian", () => {
    for (const w of RESIDENT_WORLDS) {
      expect(INHABITED_WORLDS).toContain(w);
      expect(PLACEMENT[w as InhabitedWorld]).toBeDefined();
    }
    expect(INHABITED_WORLDS).toContain("meridian");
  });

  it("marks exactly the resident worlds as having residents", () => {
    expect([...RESIDENT_SCENES].sort()).toEqual([...RESIDENT_WORLDS].sort());
    expect(hasResidents("meridian")).toBe(false);
    for (const w of RESIDENT_WORLDS) expect(hasResidents(w as InhabitedWorld)).toBe(true);
  });

  it("gives every world a distinct lounge room", () => {
    const rooms = INHABITED_WORLDS.map((w) => PLACEMENT[w].room);
    expect(new Set(rooms).size).toBe(rooms.length);
  });
});

describe("containment", () => {
  it("keeps residents on usable ground in every world", () => {
    for (const world of RESIDENT_SCENES) {
      const p = PLACEMENT[world];
      const b = BOUNDS[world];
      for (const [rx, rz] of roamSamples()) {
        const [x, z] = toScene(p, rx, rz);
        expect(
          Math.abs(x) <= b.x,
          `${world} x=${x.toFixed(1)} outside ${b.x} (${b.note})`
        ).toBe(true);
        expect(
          Math.abs(z) <= b.z,
          `${world} z=${z.toFixed(1)} outside ${b.z} (${b.note})`
        ).toBe(true);
      }
    }
  });

  it("keeps Waypoint's crew on the tarmac, not just inside a bounding box", () => {
    // The regression this guards: mapping the roam disc isotropically would
    // put residents at z = +/-74 on a strip whose tarmac ends at 45.
    const p = PLACEMENT.waypoint;
    const [, deepZ] = toScene(p, 0, ROAM_RADIUS);
    expect(Math.abs(deepZ)).toBeLessThan(45);
    // ...while still using the runway's length, or the port reads as a blob.
    const [farX] = toScene(p, ROAM_RADIUS, 0);
    expect(Math.abs(farX)).toBeGreaterThan(60);
  });

  it("keeps visitors on usable ground too", () => {
    for (const world of INHABITED_WORLDS) {
      const p = PLACEMENT[world];
      const b = BOUNDS[world];
      for (let i = 0; i < 40; i++) {
        const [x, z] = visitorSpot(p, `agent-${i}`, i);
        expect(Math.abs(x), `${world} visitor x=${x.toFixed(1)}`).toBeLessThanOrEqual(b.x);
        expect(Math.abs(z), `${world} visitor z=${z.toFixed(1)}`).toBeLessThanOrEqual(b.z);
      }
    }
  });

  it("maps the roam origin to the world's inhabited centre", () => {
    for (const world of RESIDENT_SCENES) {
      const p = PLACEMENT[world];
      expect(toScene(p, 0, 0)).toEqual([p.centre.x, p.centre.z]);
    }
  });
});

describe("separation", () => {
  it("stands visitors outside the residents' working area", () => {
    for (const world of RESIDENT_SCENES) {
      const p = PLACEMENT[world];
      // The visitor ellipse clears the resident spread on both axes, so the
      // two populations never interleave however the tick moves people.
      expect(p.visitors.rx, `${world} rx`).toBeGreaterThan(p.spread.x);
      expect(p.visitors.rz, `${world} rz`).toBeGreaterThan(p.spread.z);
    }
  });
});

describe("stability", () => {
  it("gives the same agent the same spot across polls", () => {
    const p = PLACEMENT.crucible;
    const first = visitorSpot(p, "VaultBot", 0);
    const again = visitorSpot(p, "VaultBot", 0);
    expect(again).toEqual(first);
  });

  it("separates agents that share an index", () => {
    const p = PLACEMENT.lathe;
    const a = visitorSpot(p, "IQ-Node", 0);
    const b = visitorSpot(p, "ForgeAI", 0);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(1);
  });

  it("spreads a full roster without collisions", () => {
    const p = PLACEMENT.waypoint;
    const names = ["Sable", "IQ-Node", "ForgeAI", "RoastBot", "TheCurator", "VaultBot", "SimCore", "The-Warden"];
    const spots = names.map((n, i) => visitorSpot(p, n, i));
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const d = Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1]);
        expect(d, `${names[i]} vs ${names[j]}`).toBeGreaterThan(2);
      }
    }
  });

  it("hashes names deterministically", () => {
    expect(hashName("Sable")).toBe(hashName("Sable"));
    expect(hashName("Sable")).not.toBe(hashName("Wick"));
  });
});

describe("presence honesty", () => {
  const now = Date.UTC(2026, 7, 5, 12, 0, 0);
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("embodies an agent seen recently", () => {
    expect(embodiable(ago(0), now)).toBe(true);
    expect(embodiable(ago(60 * 60 * 1000), now)).toBe(true);
    expect(embodiable(ago(VISITOR_MAX_AGE_MS - 1000), now)).toBe(true);
  });

  it("refuses to stand an abandoned probe on the ground", () => {
    // The real case this exists for: the live rooms feed still lists
    // DogfoodProbe-1784001150 in room 1, last active 2026-07-14. A dimmed
    // moon can carry that; a body on the arena floor asserts presence.
    expect(embodiable("2026-07-14T03:53:08.004Z", now)).toBe(false);
    expect(embodiable(ago(VISITOR_MAX_AGE_MS + 1000), now)).toBe(false);
  });

  it("treats an unparseable timestamp as not present", () => {
    expect(embodiable("", now)).toBe(false);
    expect(embodiable("not a date", now)).toBe(false);
  });
});
