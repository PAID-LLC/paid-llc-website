import { describe, expect, it } from "vitest";
import {
  VAULT_POS,
  buildPrecursorHistory,
} from "@/lib/palimpsest/history";
import {
  SITE_APRON,
  WORLD_SCALE,
  buildRubble,
  buildRuinField,
  duneHeight,
  toWorld,
  trailWorld,
} from "@/lib/palimpsest/terrain";

// The 3D ruins' massing layer, pinned like Arclight's skyline: the world
// mapping is fixed, the ruin kits are deterministic, the rubble never lands
// on a dig site, and the trail visits every site in excavation order.

describe("palimpsest terrain", () => {
  it("pins the map-to-world transform", () => {
    expect(toWorld(300, 260)).toEqual([0, 0]);
    expect(toWorld(0, 0)).toEqual([-150, -130]);
    expect(toWorld(600, 520)).toEqual([150, 130]);
  });

  it("builds a deterministic ruin kit for every site", () => {
    const a = buildRuinField(77);
    const b = buildRuinField(77);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));

    const field = buildRuinField();
    const sites = buildPrecursorHistory().sites;
    expect(field.length).toBe(sites.length);
    field.forEach((ruin, i) => {
      expect(ruin.id).toBe(sites[i].id);
      expect(ruin.columns.length).toBeGreaterThanOrEqual(5);
      expect(ruin.columns.length).toBeLessThanOrEqual(8);
      expect(ruin.walls.length).toBeGreaterThanOrEqual(2);
      expect(ruin.slabs.length).toBeGreaterThanOrEqual(2);
      for (const c of ruin.columns) {
        expect(c.h).toBeGreaterThanOrEqual(1.6);
        expect(c.h).toBeLessThanOrEqual(3.8);
      }
    });
  });

  it("keeps the rubble field off every dig site and the vault", () => {
    const stones = buildRubble();
    expect(stones.length).toBeGreaterThan(60);
    const clearings = buildPrecursorHistory().sites.map((s) => ({
      p: toWorld(s.x, s.y),
      r: s.r * WORLD_SCALE,
    }));
    clearings.push({
      p: toWorld(VAULT_POS.x, VAULT_POS.y),
      r: VAULT_POS.r * WORLD_SCALE,
    });
    for (const st of stones) {
      for (const c of clearings) {
        expect(Math.hypot(st.x - c.p[0], st.z - c.p[1])).toBeGreaterThan(c.r);
      }
    }
  });

  it("flattens the dunes at every site so the digs sit on clean ground", () => {
    const sites = buildPrecursorHistory().sites;
    for (const s of sites) {
      const [x, z] = toWorld(s.x, s.y);
      expect(Math.abs(duneHeight(x, z))).toBeLessThan(0.02);
    }
    const [vx, vz] = toWorld(VAULT_POS.x, VAULT_POS.y);
    expect(Math.abs(duneHeight(vx, vz))).toBeLessThan(0.02);
    // Out in the open sea the dunes actually rise.
    expect(SITE_APRON).toBeGreaterThan(0);
    let maxAbs = 0;
    for (let x = -140; x <= 140; x += 7) {
      for (let z = -120; z <= 120; z += 7) {
        maxAbs = Math.max(maxAbs, Math.abs(duneHeight(x, z)));
      }
    }
    expect(maxAbs).toBeGreaterThan(0.5);
  });

  it("routes the dig trail through all 19 sites to the vault, in order", () => {
    const trail = trailWorld();
    const sites = buildPrecursorHistory().sites;
    expect(trail.length).toBe(sites.length + 1);
    sites.forEach((s, i) => {
      expect(trail[i]).toEqual(toWorld(s.x, s.y));
    });
    expect(trail[trail.length - 1]).toEqual(toWorld(VAULT_POS.x, VAULT_POS.y));
  });
});
