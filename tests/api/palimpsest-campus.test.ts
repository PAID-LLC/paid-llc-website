/**
 * Tests for lib/palimpsest/campus.ts — the field school, as a plan.
 *
 * The brief for this world was "open and similar to a college campus." Openness
 * is a property of a plan, not a judgement about a screenshot, and nothing in
 * this environment can look at the render. So the properties that make it a
 * campus rather than a street are asserted here as arithmetic: which sides of a
 * quad are built against, whether the axis runs clear end to end, and whether
 * anything at all has been placed off the terrace it is supposed to stand on.
 *
 * Geography is pinned deliberately. A failing coordinate test means someone
 * moved a building, which should be a decision, not a side effect.
 */

import { describe, expect, it } from "vitest";
import {
  AXIS_X,
  CAMERA,
  COLONNADES,
  COLUMN_H,
  FOLIO_HUE,
  MASSES,
  NAMED_BOARDS,
  QUADS,
  STEP_RISE,
  STEP_TREAD,
  axisClear,
  buildBeams,
  buildColumns,
  buildHungBoards,
  buildKerb,
  buildMassDetail,
  buildRoutes,
  buildSteps,
  buildTables,
  builtSides,
  crowdSize,
  debateCircles,
  folioHue,
  openBearings,
  projectNdc,
  shotSubjects,
} from "@/lib/palimpsest/campus";
import { CAMPUS_PAD, WORLD_SCALE, duneHeight, toWorld } from "@/lib/palimpsest/terrain";
import { VAULT_POS, buildPrecursorHistory } from "@/lib/palimpsest/history";

const PAD_N = CAMPUS_PAD.cz - CAMPUS_PAD.d / 2;
const PAD_S = CAMPUS_PAD.cz + CAMPUS_PAD.d / 2;
const PAD_W = CAMPUS_PAD.cx - CAMPUS_PAD.w / 2;
const PAD_E = CAMPUS_PAD.cx + CAMPUS_PAD.w / 2;

/** Is (x, z) on the terrace, allowing a small margin for a kerb or a footing? */
function onPad(x: number, z: number, margin = 1.2): boolean {
  return x >= PAD_W - margin && x <= PAD_E + margin && z >= PAD_N - margin && z <= PAD_S + margin;
}

describe("the campus is open", () => {
  it("builds against at most three sides of any quad", () => {
    for (const q of QUADS) {
      expect(builtSides(q).length).toBeLessThanOrEqual(3);
    }
  });

  it("flanks the Great Quad east and west, leaving the axis ends free", () => {
    const sides = builtSides(QUADS[0]).sort();
    expect(sides).toEqual(["east", "west"]);
  });

  it("closes only the Lower Quad's east side", () => {
    expect(builtSides(QUADS[1])).toEqual(["east"]);
  });

  it("leaves at least two cardinal bearings clear of built mass", () => {
    const open = openBearings();
    expect(open.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the north-south axis open in both directions", () => {
    // North is the vault, south is the unexcavated city. Those are the two
    // views the whole plan exists to frame; if either closes, the campus has
    // become a courtyard.
    const open = openBearings();
    expect(open).toContain("north");
    expect(open).toContain("south");
  });

  it("runs the axis clear from end to end", () => {
    expect(axisClear()).toBe(true);
  });
});

describe("everything stands on the terrace", () => {
  it("places every building on the pad", () => {
    for (const m of MASSES) {
      expect(onPad(m.x - m.w / 2, m.z - m.d / 2), `${m.id} SW`).toBe(true);
      expect(onPad(m.x + m.w / 2, m.z + m.d / 2), `${m.id} NE`).toBe(true);
    }
  });

  it("places every quad on the pad", () => {
    for (const q of QUADS) {
      expect(onPad(q.cx - q.w / 2, q.cz - q.d / 2), `${q.id} SW`).toBe(true);
      expect(onPad(q.cx + q.w / 2, q.cz + q.d / 2), `${q.id} NE`).toBe(true);
    }
  });

  it("places every column, board, table and step on the pad", () => {
    for (const c of buildColumns()) expect(onPad(c.x, c.z), `column ${c.x},${c.z}`).toBe(true);
    for (const b of [...NAMED_BOARDS, ...buildHungBoards()]) {
      expect(onPad(b.x, b.z), `board ${b.id}`).toBe(true);
    }
    for (const t of buildTables()) expect(onPad(t.x, t.z), `table ${t.x},${t.z}`).toBe(true);
    for (const s of buildSteps()) expect(onPad(s.x, s.z), `step ${s.z}`).toBe(true);
  });

  it("holds the terrace dead flat under the campus", () => {
    // Every walking body samples duneHeight. If the pad were not flat, the
    // paving would float over a swell somewhere in the middle of the quad.
    for (let x = PAD_W + 2; x <= PAD_E - 2; x += 4) {
      for (let z = PAD_N + 2; z <= PAD_S - 2; z += 4) {
        expect(duneHeight(x, z)).toBeCloseTo(CAMPUS_PAD.y, 6);
      }
    }
  });

  it("returns to open dune well outside the pad", () => {
    // Far enough out that the feather has fully run out.
    expect(Math.abs(duneHeight(PAD_W - 40, CAMPUS_PAD.cz) - CAMPUS_PAD.y)).toBeGreaterThan(0.4);
  });
});

describe("the campus keeps clear of the dig", () => {
  it("puts no building inside a dig site's mound", () => {
    const sites = buildPrecursorHistory().sites.map((s) => {
      const [x, z] = toWorld(s.x, s.y);
      return { name: s.name, x, z, r: s.r * WORLD_SCALE };
    });
    for (const m of MASSES) {
      for (const s of sites) {
        // Nearest point of the building's footprint to the site centre.
        const dx = Math.max(0, Math.abs(m.x - s.x) - m.w / 2);
        const dz = Math.max(0, Math.abs(m.z - s.z) - m.d / 2);
        expect(Math.hypot(dx, dz), `${m.id} vs ${s.name}`).toBeGreaterThan(s.r);
      }
    }
  });

  it("puts no building inside the Colophon Vault", () => {
    const [vx, vz] = toWorld(VAULT_POS.x, VAULT_POS.y);
    const vr = VAULT_POS.r * WORLD_SCALE;
    for (const m of MASSES) {
      const dx = Math.max(0, Math.abs(m.x - vx) - m.w / 2);
      const dz = Math.max(0, Math.abs(m.z - vz) - m.d / 2);
      expect(Math.hypot(dx, dz), m.id).toBeGreaterThan(vr);
    }
  });

  it("stops the terrace short of the vault's own clearing", () => {
    const [, vz] = toWorld(VAULT_POS.x, VAULT_POS.y);
    expect(PAD_N).toBeGreaterThan(vz + VAULT_POS.r * WORLD_SCALE);
  });
});

describe("massing reads at body scale", () => {
  // A body in CrowdFigures stands about 2.9 world units. The Lathe pass
  // established that detail under roughly 5% of an object's span disappears
  // however good the surface is; these are the numbers that keep this world
  // from repeating it.

  it("stands columns well above head height", () => {
    expect(COLUMN_H).toBeGreaterThan(2.9 * 1.6);
  });

  it("cuts steps you could sit on rather than bevels", () => {
    expect(STEP_RISE / STEP_TREAD).toBeGreaterThan(0.35);
    expect(buildSteps()).toHaveLength(4);
    // Each tier is taller than the last, so the run genuinely climbs.
    const heights = buildSteps().map((s) => s.h);
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeGreaterThan(heights[i - 1]);
    }
  });

  it("keeps the cloister bridge above walking height", () => {
    const beams = buildBeams();
    const bridge = beams[beams.length - 2];
    expect(bridge.y - bridge.h / 2).toBeGreaterThan(CAMPUS_PAD.y + 2.9);
  });

  it("puts a kerb on all four sides of the terrace", () => {
    expect(buildKerb()).toHaveLength(4);
  });
});

describe("folio colour carries stratigraphy", () => {
  it("has one hue per age", () => {
    expect(FOLIO_HUE).toHaveLength(9);
  });

  it("gives every age a distinct hue", () => {
    expect(new Set(FOLIO_HUE).size).toBe(9);
  });

  it("clamps out-of-range folios instead of returning undefined", () => {
    expect(folioHue(0)).toBe(FOLIO_HUE[0]);
    expect(folioHue(-4)).toBe(FOLIO_HUE[0]);
    expect(folioHue(99)).toBe(FOLIO_HUE[8]);
    expect(folioHue(5)).toBe(FOLIO_HUE[4]);
  });

  it("never hangs two boards of the same age side by side in a run", () => {
    const boards = buildHungBoards();
    for (const c of COLONNADES) {
      const run = boards
        .filter((b) => b.id.startsWith(c.id))
        .sort((a, b) => a.z - b.z);
      for (let i = 1; i < run.length; i++) {
        expect(run[i].folio, `${c.id} bay ${i}`).not.toBe(run[i - 1].folio);
      }
    }
  });

  it("leaves gaps in every colonnade run to see through", () => {
    const boards = buildHungBoards();
    for (const c of COLONNADES) {
      const run = boards.filter((b) => b.id.startsWith(c.id));
      expect(run.length, c.id).toBeLessThan(c.n - 1);
    }
  });
});

describe("population comes from real traffic", () => {
  it("never empties the campus, whatever the feed says", () => {
    expect(crowdSize(0)).toBe(10);
    expect(debateCircles(0)).toHaveLength(1);
  });

  it("survives a broken feed without emptying or exploding", () => {
    expect(crowdSize(NaN)).toBe(10);
    expect(crowdSize(-50)).toBe(10);
    expect(debateCircles(NaN)).toHaveLength(1);
    expect(debateCircles(-3)).toHaveLength(1);
  });

  it("grows with traffic and then saturates", () => {
    expect(crowdSize(6)).toBeGreaterThan(crowdSize(0));
    expect(crowdSize(30)).toBeGreaterThan(crowdSize(6));
    expect(crowdSize(10_000)).toBeLessThanOrEqual(46);
  });

  it("caps debate circles at the spots that actually exist", () => {
    expect(debateCircles(1_000)).toHaveLength(6);
    for (const c of debateCircles(1_000)) {
      expect(onPad(c.x, c.z), `circle ${c.x},${c.z}`).toBe(true);
      expect(c.n).toBeGreaterThanOrEqual(3);
    }
  });

  it("puts three circles on the ground at today's live reading", () => {
    // survey_teams_24h was 6 when this world was rebuilt. Not a fixed
    // expectation of the feed — a check that a realistic reading produces a
    // populated quad rather than one lonely ring.
    expect(debateCircles(6)).toHaveLength(3);
  });
});

describe("routes", () => {
  const routes = buildRoutes();

  it("gives the axis the longest run", () => {
    const len = (pts: [number, number][]) =>
      pts.reduce((sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])), 0);
    const axis = len(routes[0].pts);
    for (let i = 1; i < routes.length; i++) {
      if (routes[i].loop) continue;
      expect(axis, `route ${i}`).toBeGreaterThan(len(routes[i].pts));
    }
  });

  it("runs the axis down the campus centreline", () => {
    for (const [x] of routes[0].pts) expect(x).toBe(AXIS_X);
  });

  it("has no zero-length segments to divide by", () => {
    for (const [i, r] of routes.entries()) {
      for (let k = 1; k < r.pts.length; k++) {
        const d = Math.hypot(r.pts[k][0] - r.pts[k - 1][0], r.pts[k][1] - r.pts[k - 1][1]);
        expect(d, `route ${i} segment ${k}`).toBeGreaterThan(0.5);
      }
    }
  });

  it("circles the vault without crossing it", () => {
    const [vx, vz] = toWorld(VAULT_POS.x, VAULT_POS.y);
    const vr = VAULT_POS.r * WORLD_SCALE;
    for (const [x, z] of routes[4].pts) {
      expect(Math.hypot(x - vx, z - vz)).toBeGreaterThan(vr);
    }
  });

  it("keeps walkers out of the buildings", () => {
    for (const [i, r] of routes.entries()) {
      for (const [x, z] of r.pts) {
        for (const m of MASSES) {
          const inside = Math.abs(x - m.x) < m.w / 2 && Math.abs(z - m.z) < m.d / 2;
          expect(inside, `route ${i} inside ${m.id}`).toBe(false);
        }
      }
    }
  });
});

describe("no coplanar faces", () => {
  // Travis found flickering rooftops. Cause: the cornice's top face landed on
  // exactly the building's own roof plane, so the depth buffer had no way to
  // choose between them and the winner flipped per pixel per frame.
  //
  // Nothing else in this repo can catch that — the tests passed, the build
  // passed, and it only showed up when a person looked at it on a screen. So
  // it becomes arithmetic: any two boxes whose footprints overlap must not
  // share a horizontal face plane.

  interface B { id: string; x: number; z: number; w: number; d: number; lo: number; hi: number }

  const boxes: B[] = [];
  const add = (id: string, x: number, z: number, w: number, d: number, y: number, h: number) =>
    boxes.push({ id, x, z, w, d, lo: y - h / 2, hi: y + h / 2 });

  for (const m of MASSES) add(`${m.id}:box`, m.x, m.z, m.w, m.d, CAMPUS_PAD.y + m.h / 2, m.h);
  buildMassDetail().forEach((b, i) => add(`detail:${b.part}:${i}`, b.x, b.z, b.w, b.d, b.y, b.h));
  buildBeams().forEach((b, i) => add(`beam:${i}`, b.x, b.z, b.w, b.d, b.y, b.h));
  buildSteps().forEach((b, i) => add(`step:${i}`, b.x, b.z, b.w, b.d, b.y, b.h));
  buildKerb().forEach((b, i) => add(`kerb:${i}`, b.x, b.z, b.w, b.d, b.y, b.h));
  buildColumns().forEach((c, i) =>
    add(`column:${i}`, c.x, c.z, c.r * 2, c.r * 2, CAMPUS_PAD.y + c.h / 2, c.h)
  );

  const overlapsXZ = (a: B, b: B) =>
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-6 &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-6;

  it("shares no horizontal face between overlapping boxes", () => {
    const clashes: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (!overlapsXZ(a, b)) continue;
        for (const [an, av] of [["lo", a.lo], ["hi", a.hi]] as const) {
          for (const [bn, bv] of [["lo", b.lo], ["hi", b.hi]] as const) {
            if (Math.abs(av - bv) < 1e-6) {
              clashes.push(`${a.id}.${an} == ${b.id}.${bn} @ y=${av.toFixed(3)}`);
            }
          }
        }
      }
    }
    expect(clashes, clashes.slice(0, 8).join("\n")).toHaveLength(0);
  });

  it("seats the architrave into the columns rather than on them", () => {
    const beam = buildBeams()[0];
    const columnTop = CAMPUS_PAD.y + COLUMN_H;
    expect(beam.y - beam.h / 2).toBeLessThan(columnTop);
  });

  it("finishes every cornice below its own roofline", () => {
    const cornices = buildMassDetail().filter((b) => b.part === "cornice");
    expect(cornices).toHaveLength(MASSES.length);
    cornices.forEach((c, i) => {
      expect(c.y + c.h / 2, MASSES[i].id).toBeLessThan(CAMPUS_PAD.y + MASSES[i].h);
    });
  });

  it("overlaps the stair treads so no riser is coplanar with its neighbour", () => {
    const steps = buildSteps();
    for (let i = 1; i < steps.length; i++) {
      const prevFar = steps[i - 1].z + steps[i - 1].d / 2;
      const nextNear = steps[i].z - steps[i].d / 2;
      expect(nextNear, `step ${i}`).toBeLessThan(prevFar);
    }
  });

  it("covers the cloister deck with its roof instead of floating it", () => {
    const beams = buildBeams();
    const deck = beams[beams.length - 2];
    const roof = beams[beams.length - 1];
    expect(roof.y - roof.h / 2).toBeLessThan(deck.y + deck.h / 2);
  });
});

describe("the opening shot", () => {
  // Nothing here can composite a frame, so the composition is asserted rather
  // than looked at. If someone moves a quad or the camera, this is what tells
  // them the world stopped framing itself.
  const s = shotSubjects();
  const seen = Object.fromEntries(
    Object.entries(s).map(([k, p]) => [k, projectNdc(p)])
  );

  it("has everything in front of the camera", () => {
    for (const [k, v] of Object.entries(seen)) expect(v, k).not.toBeNull();
  });

  it("puts the Question Stone on the centreline", () => {
    expect(Math.abs(seen.questionStone!.x)).toBeLessThan(0.06);
  });

  it("keeps the sealed vault in frame beyond it", () => {
    const v = seen.vault!;
    expect(Math.abs(v.x)).toBeLessThan(1);
    expect(Math.abs(v.y)).toBeLessThan(1);
    // And genuinely further away than the campus, or it is not "beyond".
    expect(v.dist).toBeGreaterThan(seen.questionStone!.dist);
  });

  it("holds the whole Great Quad and both ranges in frame", () => {
    for (const k of ["greatNW", "greatNE", "greatSW", "greatSE", "westRangeTop", "eastRangeTop"]) {
      expect(Math.abs(seen[k]!.x), `${k} x`).toBeLessThan(1);
      expect(Math.abs(seen[k]!.y), `${k} y`).toBeLessThan(1);
    }
  });

  it("fills the frame without overflowing it", () => {
    const xs = Object.values(seen).map((v) => v!.x);
    const fill = (Math.max(...xs) - Math.min(...xs)) / 2;
    expect(fill).toBeGreaterThan(0.55); // not a distant model on a table
    expect(fill).toBeLessThan(1.1); // not so close the campus is cropped away
  });

  it("shows the axis receding, not flattened", () => {
    // The far corners of the Great Quad must sit INSIDE the near ones, which is
    // what one-point perspective down an open axis actually looks like. If this
    // ever inverts, the camera has swung off the axis.
    const nearHalf = Math.abs(seen.greatSE!.x - seen.greatSW!.x) / 2;
    const farHalf = Math.abs(seen.greatNE!.x - seen.greatNW!.x) / 2;
    expect(farHalf).toBeLessThan(nearHalf);
    expect(seen.greatNW!.dist).toBeGreaterThan(seen.greatSW!.dist);
  });

  it("looks straight down the axis", () => {
    expect(CAMERA.pos[0]).toBe(CAMERA.target[0]);
    expect(CAMERA.pos[0]).toBe(AXIS_X + 1); // one unit off, so it is not a mirror
    expect(CAMERA.pos[1]).toBeGreaterThan(CAMERA.target[1]); // looking down
  });
});

describe("pinned geography", () => {
  // These numbers are the plan. Changing one is a decision.
  it("holds the axis and the terrace where they were placed", () => {
    expect(AXIS_X).toBe(-20);
    expect([PAD_W, PAD_E, PAD_N, PAD_S]).toEqual([-44, 4, 36, 96]);
  });

  it("holds the buildings where they were placed", () => {
    expect(MASSES.map((m) => [m.id, m.x, m.z, m.h])).toEqual([
      ["west-range", -39.2, 57, 8.5],
      ["east-range", -0.8, 57, 8.5],
      ["register", -6, 86, 13],
    ]);
  });

  it("faces every named board into the campus", () => {
    const byId = Object.fromEntries(NAMED_BOARDS.map((b) => [b.id, b]));
    // 0 faces south down the axis; -PI/2 faces west; +PI/2 faces east.
    expect(byId.question.ry).toBe(0);
    expect(byId.contested.ry).toBeCloseTo(-Math.PI / 2, 6);
    expect(byId.long.ry).toBeCloseTo(Math.PI / 2, 6);
    expect(byId.register.ry).toBeCloseTo(-Math.PI / 2, 6);
  });

  it("keeps the four named boards distinct and accounted for", () => {
    expect(NAMED_BOARDS.map((b) => b.kind)).toEqual([
      "question",
      "contested",
      "long",
      "register",
    ]);
  });
});
