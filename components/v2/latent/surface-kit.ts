import * as THREE from "three";

// ── Procedural surface materials ─────────────────────────────────────────────
//
// The third shared layer, under ground-fx.tsx (atmosphere) and world-kit.tsx
// (mass and grade). This one supplies SURFACE — the thing every world was
// missing.
//
// The measurement that produced this file: across all eight world scenes there
// were 217 materials and ZERO texture maps. Not one `map`, `normalMap`,
// `roughnessMap`, or `aoMap` anywhere, and no environment map either, which
// also meant all 27 declared `metalness` values were inert (a metal renders
// what it reflects; with nothing to reflect it only darkens). Every structure
// in Arclight was a solid near-black box between #0c1118 and #16130f. That is
// why the worlds read as objects rather than places — no amount of lighting
// can reveal a surface that carries no information.
//
// The generator here is a direct descendant of universe/planet-textures.ts,
// which has been producing convincing procedural planet skins since the
// universe map shipped. Same idea, aimed at the ground instead of the sky.
//
// Two design decisions worth knowing before editing:
//
//   1. TEXTURES ARE GENERATED, NEVER FETCHED. Canvas + noise + ImageData, in
//      memory, at mount. Zero download bytes, no CSP exposure, no new
//      dependency. A full set is ~40ms and is cached for the module's life.
//   2. PROJECTION IS TRIPLANAR IN WORLD SPACE, NOT UV. This matters more than
//      the textures do. Arclight's buildings are a single instanced box scaled
//      per lot, from 6-unit stalls to 40-unit towers; a UV-mapped texture
//      would stretch each one differently and the city would look like it was
//      wrapped in cling film. Sampling by world position gives every surface
//      identical texel density for free, with no UV authoring at all, and it
//      is scale-invariant so the same material works on a kerb and a tower.

const TILE = 256;

// ── Periodic value noise ─────────────────────────────────────────────────────
// Tiling is not optional here: a triplanar material samples with unbounded
// world coordinates, so a texture that does not wrap seamlessly shows a grid
// of visible seams across the entire world. The lattice is therefore taken
// modulo the octave frequency, which makes every octave periodic over exactly
// one tile.

function latticeHash(ix: number, iy: number, seed: number): number {
  let h = seed ^ Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function periodicNoise(x: number, y: number, period: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const w = (n: number) => ((n % period) + period) % period;
  const x0 = w(ix);
  const x1 = w(ix + 1);
  const y0 = w(iy);
  const y1 = w(iy + 1);
  const c00 = latticeHash(x0, y0, seed);
  const c10 = latticeHash(x1, y0, seed);
  const c01 = latticeHash(x0, y1, seed);
  const c11 = latticeHash(x1, y1, seed);
  const a = c00 + (c10 - c00) * fx;
  const b = c01 + (c11 - c01) * fx;
  return a + (b - a) * fy;
}

/** Tiling fbm over the unit square. `base` is cycles per tile. */
function fbm(u: number, v: number, base: number, octaves: number, seed: number): number {
  let value = 0;
  let amp = 0.5;
  let freq = base;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    value += amp * periodicNoise(u * freq, v * freq, freq, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return value / norm;
}

function fract(n: number): number {
  return n - Math.floor(n);
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function rgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// ── Spec ─────────────────────────────────────────────────────────────────────

export interface SurfaceSpec {
  /** Grime/rust/salt colour the weathering tints toward. Read as a TINT, not a
   *  paint: the albedo multiplies the mesh colour, so this shifts hue rather
   *  than replacing it. Keep it mid-luminance or the surface goes muddy. */
  stain: string;
  /** Panel seams per tile, across and down. Horizontal seams read as floor
   *  slabs and are the single strongest "this is a building" cue. */
  panelsX: number;
  panelsY: number;
  /** How dark the seams cut, 0-1. */
  seam: number;
  /** Weathering: mottling, streaking below seams, stain saturation. 0-1. */
  wear: number;
  /** Fraction of the surface that reads wet/polished. Needs an environment map
   *  to be worth anything — a smooth surface with nothing to reflect is just
   *  a dark surface. */
  wet: number;
  /** Base roughness the map modulates around. */
  rough: number;
  /** Surface relief in the normal map, world-ish units. 0 disables. */
  relief: number;
}

export interface Surface {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  dispose(): void;
}

// ── Generation ───────────────────────────────────────────────────────────────

function toTexture(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  // Linear for the data maps. Getting this wrong on a roughness or normal map
  // is the classic "why does my PBR look like plastic" bug: the sRGB curve
  // silently rewrites the values.
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function blank(): { canvas: HTMLCanvasElement; data: ImageData } {
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d")!;
  return { canvas, data: ctx.createImageData(TILE, TILE) };
}

function commit(canvas: HTMLCanvasElement, data: ImageData): HTMLCanvasElement {
  canvas.getContext("2d")!.putImageData(data, 0, 0);
  return canvas;
}

/**
 * Build the height field once, then derive albedo, roughness and normals from
 * it. Deriving all three from shared relief is what makes them agree: a seam
 * that reads dark in the albedo is also recessed in the normal and rougher in
 * the roughness, which is exactly what sells it as geometry rather than paint.
 */
function heightField(spec: SurfaceSpec, seed: number): Float32Array {
  const h = new Float32Array(TILE * TILE);
  for (let y = 0; y < TILE; y++) {
    // Textures flip Y, so canvas row 0 is v=1. For a wall the second triplanar
    // coordinate is world Y, which makes -v the down direction — the streaks
    // below rely on this and will run upward if it is ever changed.
    const v = 1 - y / TILE;
    for (let x = 0; x < TILE; x++) {
      const u = x / TILE;

      // Broad surface undulation — cast concrete is never flat.
      let e = 0.5 + 0.5 * (fbm(u, v, 5, 4, seed) - 0.5);

      // Fine tooth.
      e += 0.06 * (fbm(u, v, 26, 2, seed + 7) - 0.5);

      // Panel seams, cut in both axes. Distance to the nearest seam line, 0 at
      // the seam, 1 mid-panel.
      const dx = Math.abs(fract(u * spec.panelsX) - 0.5) * 2;
      const dy = Math.abs(fract(v * spec.panelsY) - 0.5) * 2;
      const cut = Math.max(
        Math.pow(clamp01(dx), 14),
        Math.pow(clamp01(dy), 14)
      );
      e -= cut * spec.seam * 0.9;

      h[y * TILE + x] = e;
    }
  }
  return h;
}

function albedoCanvas(spec: SurfaceSpec, seed: number, h: Float32Array): HTMLCanvasElement {
  const { canvas, data } = blank();
  const d = data.data;
  const stain = rgb(spec.stain);

  for (let y = 0; y < TILE; y++) {
    const v = 1 - y / TILE;
    for (let x = 0; x < TILE; x++) {
      const u = x / TILE;
      const i = y * TILE + x;

      // Relief drives shading: recessed seams read darker.
      let lum = 0.72 + 0.5 * h[i];

      // Weathering streaks. `drip` peaks just below a horizontal seam and
      // fades downward, which is where water actually runs off a slab.
      const drip = Math.pow(fract(v * spec.panelsY), 5);
      const column = fbm(u, 0.37, 34, 2, seed + 21);
      const streak = drip * clamp01((column - 0.42) * 2.4) * spec.wear;

      // Broad grime pooling, uncorrelated with the streaks so the surface does
      // not read as one repeating motif.
      const grime = clamp01(streak * 0.9 + (1 - fbm(u, v, 3, 3, seed + 33)) * 0.45 * spec.wear);

      lum *= 1 - streak * 0.34;

      const t = grime * spec.wear * 0.55;
      const r = (255 + (stain.r - 255) * t) * lum;
      const g = (255 + (stain.g - 255) * t) * lum;
      const b = (255 + (stain.b - 255) * t) * lum;

      const o = i * 4;
      d[o] = Math.max(0, Math.min(255, r));
      d[o + 1] = Math.max(0, Math.min(255, g));
      d[o + 2] = Math.max(0, Math.min(255, b));
      d[o + 3] = 255;
    }
  }
  return commit(canvas, data);
}

function roughnessCanvas(spec: SurfaceSpec, seed: number, h: Float32Array): HTMLCanvasElement {
  const { canvas, data } = blank();
  const d = data.data;

  for (let y = 0; y < TILE; y++) {
    const v = 1 - y / TILE;
    for (let x = 0; x < TILE; x++) {
      const u = x / TILE;
      const i = y * TILE + x;

      let r = spec.rough + 0.16 * (fbm(u, v, 12, 3, seed + 51) - 0.5);

      // Low ground holds water. Using the shared height field means puddles
      // land in dips rather than floating free of the relief.
      if (spec.wet > 0) {
        const pool = clamp01((0.5 - h[i]) * 3.4) * clamp01((fbm(u, v, 4, 3, seed + 71) - 0.38) * 3);
        r = r + (0.06 - r) * clamp01(pool) * spec.wet;
      }

      const c = Math.max(0, Math.min(255, r * 255));
      const o = i * 4;
      // three reads roughness from .g and metalness from .b; write all three so
      // the map stays legible if it is ever inspected by eye.
      d[o] = c;
      d[o + 1] = c;
      d[o + 2] = c;
      d[o + 3] = 255;
    }
  }
  return commit(canvas, data);
}

function normalCanvas(spec: SurfaceSpec, h: Float32Array): HTMLCanvasElement {
  const { canvas, data } = blank();
  const d = data.data;
  const strength = spec.relief * TILE * 0.06;
  const wrap = (n: number) => (n + TILE) % TILE;

  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      // Central difference, wrapped — an unwrapped gradient puts a hard seam
      // down the tile edge that no amount of texture wrapping can hide.
      const hl = h[y * TILE + wrap(x - 1)];
      const hr = h[y * TILE + wrap(x + 1)];
      const hd = h[wrap(y + 1) * TILE + x];
      const hu = h[wrap(y - 1) * TILE + x];

      const nx = (hl - hr) * strength;
      const ny = (hd - hu) * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;

      const o = (y * TILE + x) * 4;
      d[o] = (nx / len) * 127.5 + 127.5;
      d[o + 1] = (ny / len) * 127.5 + 127.5;
      d[o + 2] = (nz / len) * 127.5 + 127.5;
      d[o + 3] = 255;
    }
  }
  return commit(canvas, data);
}

// Cached for the module's life. A set is ~800KB of GPU memory and ~40ms of
// main thread to rebuild, and worlds get revisited constantly, so holding them
// beats regenerating. Materials are disposed per-scene; call disposeSurfaces()
// only when tearing the whole 3D layer down.
const CACHE = new Map<string, Surface>();

export function surface(key: string, spec: SurfaceSpec): Surface {
  const existing = CACHE.get(key);
  if (existing) return existing;

  const seed = hashStr(key);
  const h = heightField(spec, seed);
  const map = toTexture(albedoCanvas(spec, seed, h), true);
  const roughnessMap = toTexture(roughnessCanvas(spec, seed, h), false);
  const normalMap = toTexture(normalCanvas(spec, h), false);

  const built: Surface = {
    map,
    roughnessMap,
    normalMap,
    dispose() {
      map.dispose();
      roughnessMap.dispose();
      normalMap.dispose();
      CACHE.delete(key);
    },
  };
  CACHE.set(key, built);
  return built;
}

export function disposeSurfaces(): void {
  for (const s of Array.from(CACHE.values())) s.dispose();
  CACHE.clear();
}

// ── Triplanar material ───────────────────────────────────────────────────────

export interface TriplanarOptions {
  surface: Surface;
  /** Multiplied by the albedo. Leave white on instanced meshes so per-instance
   *  colour carries the variation. */
  color?: string;
  /** World units per texture tile. This is the texel-density dial: smaller
   *  tiles the detail tighter. */
  scale?: number;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  normalScale?: number;
  vertexColors?: boolean;
  /** Reduced motion drops the normal map — the relief only reads while the
   *  camera or lights move, so under a still camera it is pure cost. */
  reduced?: boolean;
}

/**
 * A MeshStandardMaterial that samples its maps by world position on three axes
 * instead of by UV.
 *
 * The patch is injected with onBeforeCompile rather than a ShaderMaterial on
 * purpose: this keeps the whole standard lighting path — IBL, fog, tone
 * mapping, instancing, shadows — instead of reimplementing it. `triB` is
 * declared in the map_fragment replacement and reused by the roughness and
 * normal replacements below it, which is safe because three emits those three
 * chunks in that order in the same scope. If a future three release reorders
 * them this breaks loudly at shader-compile time rather than silently.
 */
export function triplanarMaterial(options: TriplanarOptions): THREE.MeshStandardMaterial {
  const useNormal = options.reduced !== true && options.normalScale !== 0;
  const scale = options.scale ?? 12;

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(options.color ?? "#ffffff"),
    map: options.surface.map,
    roughnessMap: options.surface.roughnessMap,
    normalMap: useNormal ? options.surface.normalMap : null,
    roughness: options.roughness ?? 1,
    metalness: options.metalness ?? 0,
    emissive: new THREE.Color(options.emissive ?? "#000000"),
    emissiveIntensity: options.emissiveIntensity ?? 1,
    vertexColors: options.vertexColors ?? false,
  });
  if (useNormal) {
    const n = options.normalScale ?? 1;
    material.normalScale.set(n, n);
  }

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTriScale = { value: scale };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vTriPos;
        varying vec3 vTriNrm;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 triPos = vec4( transformed, 1.0 );
        vec3 triNrm = objectNormal;
        #ifdef USE_INSTANCING
          triPos = instanceMatrix * triPos;
          // Correct for the axis-aligned box scaling this is used on. A general
          // inverse-transpose would be needed for sheared instances; there are
          // none, and the normalize below absorbs pure axis scale exactly.
          triNrm = mat3( instanceMatrix ) * triNrm;
        #endif
        vTriPos = ( modelMatrix * triPos ).xyz;
        vTriNrm = mat3( modelMatrix ) * triNrm;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vTriPos;
        varying vec3 vTriNrm;
        uniform float uTriScale;

        vec3 triWeights( vec3 n ) {
          // Power 4 keeps the blend band narrow, so a wall stays a wall right
          // up to the corner instead of smearing into the roof texture.
          vec3 b = pow( abs( n ), vec3( 4.0 ) );
          return b / max( b.x + b.y + b.z, 1e-4 );
        }
        vec2 triUvX() { return vTriPos.zy / uTriScale; }
        vec2 triUvY() { return vTriPos.xz / uTriScale; }
        vec2 triUvZ() { return vTriPos.xy / uTriScale; }
        vec4 triSample( sampler2D t, vec3 b ) {
          return texture2D( t, triUvX() ) * b.x
               + texture2D( t, triUvY() ) * b.y
               + texture2D( t, triUvZ() ) * b.z;
        }`
      )
      .replace(
        "#include <map_fragment>",
        `vec3 triN = normalize( vTriNrm );
        vec3 triB = triWeights( triN );
        diffuseColor *= triSample( map, triB );`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `float roughnessFactor = roughness * triSample( roughnessMap, triB ).g;`
      );

    if (useNormal) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `vec3 tnX = texture2D( normalMap, triUvX() ).xyz * 2.0 - 1.0;
        vec3 tnY = texture2D( normalMap, triUvY() ).xyz * 2.0 - 1.0;
        vec3 tnZ = texture2D( normalMap, triUvZ() ).xyz * 2.0 - 1.0;
        tnX.xy *= normalScale;
        tnY.xy *= normalScale;
        tnZ.xy *= normalScale;
        // Whiteout blend: add the tangent-space perturbation to the surface
        // normal per axis, then recombine. Cheaper than three per-axis TBN
        // matrices and does not need tangents on the geometry.
        tnX = vec3( tnX.xy + triN.zy, abs( tnX.z ) * triN.x );
        tnY = vec3( tnY.xy + triN.xz, abs( tnY.z ) * triN.y );
        tnZ = vec3( tnZ.xy + triN.xy, abs( tnZ.z ) * triN.z );
        normal = normalize( tnX.zyx * triB.x + tnY.xzy * triB.y + tnZ.xyz * triB.z );`
      );
    }
  };

  // Without this every triplanar material collapses onto one cached program and
  // the first scale compiled wins for the whole scene.
  material.customProgramCacheKey = () => `triplanar|${scale}|${useNormal ? 1 : 0}`;

  return material;
}
