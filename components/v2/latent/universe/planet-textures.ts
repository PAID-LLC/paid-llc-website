import * as THREE from "three";
import type { PlanetConfig } from "./planet-config";

// ── Procedural planet surfaces ───────────────────────────────────────────────
// Every texture in the universe is generated here on the client at mount —
// zero fetched assets, zero new deps, and the CSP never sees an external
// request. Each generator is seeded from the theme name, so a planet's
// continents and storms are stable across visits, not a fresh roll per load.
//
// Noise strategy: 3D value noise sampled on a cylinder (cos θ, sin θ, φ) so
// the equirect texture wraps seamlessly east-west. Pole pinching is accepted:
// the poles face away from the default camera, terra hides them under ice
// caps, and the giants' banding is latitude-driven anyway.

const TEX_W = 384;
const TEX_H = 192;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lattice hash → [0,1) for integer 3D coordinates + seed.
function lat(ix: number, iy: number, iz: number, seed: number): number {
  let h = seed ^ Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function noise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
  const c000 = lat(ix, iy, iz, seed), c100 = lat(ix + 1, iy, iz, seed);
  const c010 = lat(ix, iy + 1, iz, seed), c110 = lat(ix + 1, iy + 1, iz, seed);
  const c001 = lat(ix, iy, iz + 1, seed), c101 = lat(ix + 1, iy, iz + 1, seed);
  const c011 = lat(ix, iy + 1, iz + 1, seed), c111 = lat(ix + 1, iy + 1, iz + 1, seed);
  const x00 = c000 + (c100 - c000) * fx;
  const x10 = c010 + (c110 - c010) * fx;
  const x01 = c001 + (c101 - c001) * fx;
  const x11 = c011 + (c111 - c011) * fx;
  const y0 = x00 + (x10 - x00) * fy;
  const y1 = x01 + (x11 - x01) * fy;
  return y0 + (y1 - y0) * fz;
}

function fbm(x: number, y: number, z: number, seed: number, octaves: number): number {
  let v = 0, amp = 0.5, f = 1;
  for (let o = 0; o < octaves; o++) {
    v += amp * noise3(x * f, y * f, z * f, seed + o * 101);
    amp *= 0.5;
    f *= 2;
  }
  return v; // ~[0,1)
}

interface RGB { r: number; g: number; b: number }

function rgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(a: RGB, b: RGB, t: number): RGB {
  const u = Math.min(1, Math.max(0, t));
  return { r: a.r + (b.r - a.r) * u, g: a.g + (b.g - a.g) * u, b: a.b + (b.b - a.b) * u };
}

// Shared per-pixel loop: caller maps (sample point, u, v) → RGB.
function paint(
  w: number,
  h: number,
  px: (sx: number, sy: number, sz: number, u: number, v: number) => RGB
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const v = y / h;
    const phi = v * Math.PI;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const theta = u * Math.PI * 2;
      // Cylinder sample — seamless wrap in u.
      const sx = Math.cos(theta);
      const sz = Math.sin(theta);
      const sy = Math.cos(phi) * 1.4; // stretch latitude a little
      const c = px(sx, sy, sz, u, v);
      const i = (y * w + x) * 4;
      d[i] = c.r; d[i + 1] = c.g; d[i + 2] = c.b; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 2;
  return tex;
}

// ── Surface generators ───────────────────────────────────────────────────────

/** Cratered, heat-cracked rock (Mercury-class). */
function rockCanvas(cfg: PlanetConfig, seed: number): HTMLCanvasElement {
  const p = { base: rgb(cfg.palette.base), low: rgb(cfg.palette.low), high: rgb(cfg.palette.high), detail: rgb(cfg.palette.detail) };
  const canvas = paint(TEX_W, TEX_H, (sx, sy, sz) => {
    const n = fbm(sx * 3, sy * 3, sz * 3, seed, 4);
    let c = mix(p.base, p.high, n);
    c = mix(c, p.low, noise3(sx * 7, sy * 7, sz * 7, seed + 7) * 0.4);
    // Lava cracks: thin ridges where a mid-frequency field crosses its midline.
    const ridge = Math.abs(fbm(sx * 5, sy * 5, sz * 5, seed + 31, 3) - 0.5);
    if (ridge < 0.012) c = mix(c, p.detail, 0.9 - ridge / 0.012);
    return c;
  });
  // Craters stamped on top — rim highlight, floor shadow.
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(seed + 77);
  for (let i = 0; i < 46; i++) {
    const cx = rand() * TEX_W;
    const cy = TEX_H * 0.15 + rand() * TEX_H * 0.7;
    const r = 2 + rand() * 9;
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    g.addColorStop(0, "rgba(0,0,0,0.35)");
    g.addColorStop(0.75, "rgba(0,0,0,0.12)");
    g.addColorStop(0.88, "rgba(255,220,190,0.18)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

/** Continents, oceans, polar caps (Earth-class). */
function terraCanvas(cfg: PlanetConfig, seed: number): HTMLCanvasElement {
  const ocean = rgb(cfg.palette.base), shallow = rgb(cfg.palette.low);
  const land = rgb(cfg.palette.high), forest = rgb(cfg.palette.detail);
  const white = { r: 236, g: 242, b: 246 };
  return paint(TEX_W, TEX_H, (sx, sy, sz, _u, v) => {
    const n = fbm(sx * 2.2, sy * 2.2, sz * 2.2, seed, 5);
    const polar = Math.abs(v - 0.5) * 2; // 0 equator → 1 pole
    let c: RGB;
    if (n > 0.54) {
      const t = (n - 0.54) / 0.2;
      c = mix(forest, land, Math.min(1, t + noise3(sx * 6, sy * 6, sz * 6, seed + 13) * 0.5));
    } else {
      c = mix(ocean, shallow, Math.pow(n / 0.54, 3));
    }
    if (polar > 0.82) c = mix(c, white, Math.min(1, (polar - 0.82) / 0.1));
    // Sparse cloud wisps, cheap and soft.
    const cloud = fbm(sx * 4 + 9, sy * 4, sz * 4, seed + 51, 3);
    if (cloud > 0.62) c = mix(c, white, Math.min(0.55, (cloud - 0.62) * 3));
    return c;
  });
}

/** Amber settlement speckles on land — emissive map, black elsewhere. */
function cityLightsCanvas(cfg: PlanetConfig, seed: number): HTMLCanvasElement {
  const lights = rgb(cfg.cityLights ?? "#fbbf24");
  const black = { r: 0, g: 0, b: 0 };
  return paint(TEX_W, TEX_H, (sx, sy, sz, _u, v) => {
    const n = fbm(sx * 2.2, sy * 2.2, sz * 2.2, seed, 5); // same field → lights sit on land
    const polar = Math.abs(v - 0.5) * 2;
    if (n <= 0.55 || polar > 0.8) return black;
    const cluster = noise3(sx * 9, sy * 9, sz * 9, seed + 91);
    const speck = noise3(sx * 46, sy * 46, sz * 46, seed + 92);
    if (cluster > 0.58 && speck > 0.66) return mix(black, lights, Math.min(1, (speck - 0.66) * 5));
    return black;
  });
}

/** Ice shell with lineae cracks (Europa-class). */
function crackedIceCanvas(cfg: PlanetConfig, seed: number): HTMLCanvasElement {
  const p = { base: rgb(cfg.palette.base), low: rgb(cfg.palette.low), high: rgb(cfg.palette.high), detail: rgb(cfg.palette.detail) };
  return paint(TEX_W, TEX_H, (sx, sy, sz) => {
    const n = fbm(sx * 2.5, sy * 2.5, sz * 2.5, seed, 4);
    let c = mix(p.low, p.high, n);
    c = mix(c, p.base, noise3(sx * 5, sy * 5, sz * 5, seed + 17) * 0.35);
    // Two crack systems at different frequencies — the Europa lineae look.
    const r1 = Math.abs(fbm(sx * 3.4, sy * 3.4, sz * 3.4, seed + 41, 3) - 0.5);
    const r2 = Math.abs(fbm(sx * 6.5 + 3, sy * 6.5, sz * 6.5, seed + 57, 3) - 0.5);
    if (r1 < 0.014) c = mix(c, p.detail, 0.85 - (r1 / 0.014) * 0.6);
    else if (r2 < 0.008) c = mix(c, p.detail, 0.55 - (r2 / 0.008) * 0.4);
    return c;
  });
}

/** Latitude-banded giant; `storms` adds dark ovals + bright streaks. */
function giantCanvas(cfg: PlanetConfig, seed: number, storms: boolean, smoothness = 0): HTMLCanvasElement {
  const p = { base: rgb(cfg.palette.base), low: rgb(cfg.palette.low), high: rgb(cfg.palette.high), detail: rgb(cfg.palette.detail) };
  return paint(TEX_W, TEX_H, (sx, sy, sz, _u, v) => {
    // Bands: latitude waves perturbed by turbulence, flattened by smoothness.
    const turb = (fbm(sx * 3, sy * 3, sz * 3, seed, 3) - 0.5) * (1 - smoothness);
    const band = Math.sin(v * Math.PI * (7 + (seed % 3)) + turb * 4.5) * 0.5 + 0.5;
    let c = mix(p.base, p.high, band * (1 - smoothness * 0.6) + smoothness * 0.45);
    c = mix(c, p.low, noise3(sx * 2, sy * 2, sz * 2, seed + 5) * 0.35);
    if (storms) {
      const s = fbm(sx * 4 + 7, sy * 6, sz * 4, seed + 71, 3);
      if (s > 0.66) c = mix(c, p.detail, Math.min(0.85, (s - 0.66) * 5)); // dark ovals
      if (s < 0.3) c = mix(c, { r: 225, g: 234, b: 246 }, Math.min(0.4, (0.3 - s) * 2.4)); // cirrus streaks
    }
    return c;
  });
}

/** Concentric ring bands with a Cassini-style gap — planar-mapped square canvas. */
export function makeRingTexture(themeKey: string, tint: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(hashStr(themeKey) ^ 0x9e3779b9);
  const c = rgb(tint);
  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, size * 0.28, cx, cx, size * 0.5);
  const stops = 26;
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    // The gap sits ~2/3 out, like Cassini's.
    const gap = t > 0.6 && t < 0.68 ? 0.06 : 1;
    const a = (0.14 + rand() * 0.5) * gap * (1 - Math.pow(t, 3) * 0.5);
    const l = 0.75 + rand() * 0.25;
    grad.addColorStop(t, `rgba(${Math.round(c.r * l)},${Math.round(c.g * l)},${Math.round(c.b * l)},${a.toFixed(3)})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // Punch the center transparent so the inner edge is clean.
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cx, size * 0.27, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Diagonal galactic band + star speckles + faint brand-tinted nebulae. */
export function makeMilkyWayTexture(): THREE.CanvasTexture {
  // 2048 wide: at 1024, a single speckle texel stretched over the r=200
  // backdrop sphere reads as a soft square blob, not a star.
  const w = 2048, h = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);
  const rand = mulberry32(0x1a7e57);
  // Band core: layered soft ellipses along the horizontal midline.
  for (let i = 0; i < 110; i++) {
    const x = rand() * w;
    const y = h / 2 + (rand() - 0.5) * h * 0.16;
    const r = 60 + rand() * 180;
    const a = 0.015 + rand() * 0.03;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const warm = rand() > 0.5;
    g.addColorStop(0, warm ? `rgba(214,225,244,${a})` : `rgba(190,214,238,${a})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Dust lanes cutting the band — dark blotches over the core.
  for (let i = 0; i < 26; i++) {
    const x = rand() * w;
    const y = h / 2 + (rand() - 0.5) * h * 0.07;
    const r = 36 + rand() * 92;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${0.35 + rand() * 0.3})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Two barely-there nebulae in the brand two-tone. Subtlety is the point.
  for (const [hex, bx, by] of [["#C14826", 0.22, 0.3], ["#22d3ee", 0.74, 0.66]] as const) {
    const c = rgb(hex);
    const g = ctx.createRadialGradient(w * bx, h * by, 0, w * bx, h * by, 260);
    g.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.05)`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // Star speckles — denser inside the band, 1px and faint: the drei
  // starfield owns the bright pinpoint stars, this layer is texture only.
  for (let i = 0; i < 1400; i++) {
    const x = rand() * w;
    const inBand = rand() < 0.68;
    const y = inBand ? h / 2 + (rand() - 0.5) * h * 0.3 : rand() * h;
    const a = 0.1 + rand() * 0.25;
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
    ctx.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface PlanetTextures {
  map: THREE.CanvasTexture;
  emissiveMap?: THREE.CanvasTexture;
}

export function makePlanetTextures(themeKey: string, cfg: PlanetConfig): PlanetTextures {
  const seed = hashStr(themeKey);
  switch (cfg.kind) {
    case "terra":
      return {
        map: toTexture(terraCanvas(cfg, seed)),
        emissiveMap: toTexture(cityLightsCanvas(cfg, seed)),
      };
    case "cracked-ice":
      return { map: toTexture(crackedIceCanvas(cfg, seed)) };
    case "banded-giant":
      return { map: toTexture(giantCanvas(cfg, seed, false)) };
    case "smooth-giant":
      return { map: toTexture(giantCanvas(cfg, seed, false, 0.75)) };
    case "storm-giant":
      return { map: toTexture(giantCanvas(cfg, seed, true)) };
    case "rock":
    default:
      return { map: toTexture(rockCanvas(cfg, seed)) };
  }
}
