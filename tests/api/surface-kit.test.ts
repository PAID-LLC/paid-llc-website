import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { triplanarMaterial, type Surface } from "@/components/v2/latent/surface-kit";

// The triplanar material rewrites three's own standard shader with string
// replacement. That is the fastest way to keep the whole PBR path — IBL, fog,
// instancing, tone mapping — instead of reimplementing it in a ShaderMaterial,
// but it buys a real hazard: if three renames or reorders a shader chunk in a
// future release, `String.replace` finds nothing, silently does nothing, and
// the city renders with stretched UV textures and no relief. No error, no
// warning, just a worse-looking world that nobody can explain.
//
// These tests turn that silent failure into a loud one at CI time.

function fakeSurface(windows = false): Surface {
  return {
    map: new THREE.Texture() as THREE.CanvasTexture,
    roughnessMap: new THREE.Texture() as THREE.CanvasTexture,
    normalMap: new THREE.Texture() as THREE.CanvasTexture,
    emissiveMap: windows ? (new THREE.Texture() as THREE.CanvasTexture) : null,
    dispose() {},
  };
}

/** Run a material's onBeforeCompile against three's real shader source. */
function compile(material: THREE.MeshStandardMaterial) {
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
  };
  material.onBeforeCompile(shader as never, null as never);
  return shader;
}

describe("three shader chunk contract", () => {
  const frag = THREE.ShaderLib.physical.fragmentShader;
  const vert = THREE.ShaderLib.physical.vertexShader;

  it("emits the three fragment chunks the patch replaces", () => {
    expect(frag).toContain("#include <map_fragment>");
    expect(frag).toContain("#include <roughnessmap_fragment>");
    expect(frag).toContain("#include <normal_fragment_maps>");
  });

  it("emits them in the order the patch depends on", () => {
    // triB is declared in the map_fragment replacement and reused by the two
    // below it. Reordering would put a use before its declaration.
    const map = frag.indexOf("#include <map_fragment>");
    const rough = frag.indexOf("#include <roughnessmap_fragment>");
    const normal = frag.indexOf("#include <normal_fragment_maps>");
    expect(map).toBeGreaterThan(-1);
    expect(rough).toBeGreaterThan(map);
    expect(normal).toBeGreaterThan(rough);
  });

  it("defines objectNormal before begin_vertex", () => {
    // The vertex patch reads objectNormal to build the triplanar blend normal.
    expect(THREE.ShaderChunk.beginnormal_vertex).toContain("objectNormal");
    expect(vert.indexOf("#include <beginnormal_vertex>")).toBeLessThan(
      vert.indexOf("#include <begin_vertex>")
    );
  });

  it("still reads roughness from the green channel", () => {
    // The generated roughness map writes grey, but the patch samples .g
    // explicitly. If three ever moved to another channel this would drift.
    expect(THREE.ShaderChunk.roughnessmap_fragment).toContain("texelRoughness.g");
  });

  it("emits emissivemap_fragment after map_fragment", () => {
    // The window patch reuses triB, which map_fragment's replacement declares.
    expect(frag).toContain("#include <emissivemap_fragment>");
    expect(frag.indexOf("#include <emissivemap_fragment>")).toBeGreaterThan(
      frag.indexOf("#include <map_fragment>")
    );
  });

  it("still multiplies rather than assigns totalEmissiveRadiance", () => {
    // The patch relies on the multiply: material.emissive * emissiveIntensity
    // is the brightness, and the window map is the 0-1 mask over it. An
    // upstream switch to assignment would blow every facade to full white.
    expect(THREE.ShaderChunk.emissivemap_fragment).toContain("totalEmissiveRadiance *=");
  });
});

describe("triplanarMaterial", () => {
  it("replaces every chunk it targets, leaving no include behind", () => {
    const shader = compile(triplanarMaterial({ surface: fakeSurface(), scale: 10 }));
    expect(shader.fragmentShader).not.toContain("#include <map_fragment>");
    expect(shader.fragmentShader).not.toContain("#include <roughnessmap_fragment>");
    expect(shader.fragmentShader).not.toContain("#include <normal_fragment_maps>");
    // The vertex side appends rather than replaces: begin_vertex must survive,
    // with the triplanar capture immediately after it.
    expect(shader.vertexShader).toContain("#include <begin_vertex>");
    const begin = shader.vertexShader.indexOf("#include <begin_vertex>");
    expect(shader.vertexShader.indexOf("vTriPos =")).toBeGreaterThan(begin);
  });

  it("injects the world-space varyings on both stages", () => {
    const shader = compile(triplanarMaterial({ surface: fakeSurface() }));
    expect(shader.vertexShader).toContain("varying vec3 vTriPos");
    expect(shader.vertexShader).toContain("varying vec3 vTriNrm");
    expect(shader.fragmentShader).toContain("varying vec3 vTriPos");
    expect(shader.fragmentShader).toContain("triSample");
  });

  it("carries the instance transform into world space", () => {
    // Arclight's whole skyline is one instanced box scaled per lot. Sampling
    // pre-instance position would give every building the same texture patch.
    const shader = compile(triplanarMaterial({ surface: fakeSurface() }));
    expect(shader.vertexShader).toContain("instanceMatrix * triPos");
    expect(shader.vertexShader).toContain("USE_INSTANCING");
  });

  it("declares triB before the chunks that consume it", () => {
    const { fragmentShader } = compile(triplanarMaterial({ surface: fakeSurface() }));
    const decl = fragmentShader.indexOf("vec3 triB =");
    const roughUse = fragmentShader.indexOf("triSample( roughnessMap, triB )");
    expect(decl).toBeGreaterThan(-1);
    expect(roughUse).toBeGreaterThan(decl);
  });

  it("passes the tile scale through as a uniform", () => {
    const shader = compile(triplanarMaterial({ surface: fakeSurface(), scale: 26 }));
    expect(shader.uniforms.uTriScale).toEqual({ value: 26 });
  });

  it("keys the program cache by scale, so two scales cannot share a program", () => {
    const a = triplanarMaterial({ surface: fakeSurface(), scale: 10 });
    const b = triplanarMaterial({ surface: fakeSurface(), scale: 26 });
    expect(a.customProgramCacheKey()).not.toEqual(b.customProgramCacheKey());
  });

  it("drops the normal map under reduced motion", () => {
    const plain = triplanarMaterial({ surface: fakeSurface(), reduced: true });
    expect(plain.normalMap).toBeNull();
    const shader = compile(plain);
    // The normal chunk must be left alone, not replaced with a sampler that
    // reads a map the material no longer has.
    expect(shader.fragmentShader).toContain("#include <normal_fragment_maps>");
    expect(plain.customProgramCacheKey()).not.toEqual(
      triplanarMaterial({ surface: fakeSurface() }).customProgramCacheKey()
    );
  });

  it("keeps maps and stays a standard material, so IBL and fog still apply", () => {
    const m = triplanarMaterial({ surface: fakeSurface(), color: "#273246", metalness: 0.14 });
    expect(m).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(m.map).not.toBeNull();
    expect(m.roughnessMap).not.toBeNull();
    expect(m.metalness).toBeCloseTo(0.14);
  });

  it("leaves the emissive chunk alone on a surface with no windows", () => {
    const m = triplanarMaterial({ surface: fakeSurface() });
    expect(m.emissiveMap).toBeNull();
    // Black emissive, so a stray multiply could never light a road or a roof.
    expect(m.emissive.getHex()).toBe(0x000000);
    expect(compile(m).fragmentShader).toContain("#include <emissivemap_fragment>");
  });

  it("lights windows on walls only, never on roofs", () => {
    const m = triplanarMaterial({ surface: fakeSurface(true) });
    const { fragmentShader } = compile(m);
    expect(fragmentShader).not.toContain("#include <emissivemap_fragment>");
    // The Y weight is the up-facing share. It must be excluded from the blend
    // AND fade the result, or every rooftop in the city lights up like a floor.
    expect(fragmentShader).toContain("vec3 triW = vec3( triB.x, 0.0, triB.z )");
    expect(fragmentShader).toContain("( 1.0 - triB.y )");
    expect(fragmentShader).not.toContain("texture2D( emissiveMap, triUvY() )");
  });

  it("gives a windowed material a lit emissive, or the mask multiplies to nothing", () => {
    // totalEmissiveRadiance starts at emissive * emissiveIntensity and the
    // window map multiplies it. Default-black emissive would mean the whole
    // feature silently renders as an unlit facade.
    const m = triplanarMaterial({ surface: fakeSurface(true), emissiveIntensity: 1.9 });
    expect(m.emissive.getHex()).toBe(0xffffff);
    expect(m.emissiveIntensity).toBeCloseTo(1.9);
    expect(m.emissiveMap).not.toBeNull();
  });

  it("keys the program cache by windows as well as scale", () => {
    const lit = triplanarMaterial({ surface: fakeSurface(true), scale: 10 });
    const dark = triplanarMaterial({ surface: fakeSurface(), scale: 10 });
    expect(lit.customProgramCacheKey()).not.toEqual(dark.customProgramCacheKey());
  });
});
