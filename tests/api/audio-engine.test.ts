/**
 * Tests for lib/audio/engine.ts against a fake Web Audio implementation.
 *
 * Why bother mocking an audio API: `say()` is the headline of this feature and
 * it was the one path with no coverage at all. lib/audio/speech.ts proves the
 * PLAN is right, and the preview proved the bed's graph gets built, but neither
 * touches the code that turns a plan into oscillators — and this environment
 * has no audio device to listen with. So the graph is asserted structurally
 * here instead of being taken on trust.
 *
 * The mock is deliberately strict about the two failure modes that are silent
 * rather than loud, and therefore the ones a human would never catch by ear:
 *
 *   NaN into an AudioParam throws, and takes the whole bed down with it.
 *   A negative or zero frequency is inaudible rather than wrong-sounding.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── A fake Web Audio API ─────────────────────────────────────────────────────

interface ParamCall {
  method: string;
  value: number;
  time: number;
}

class FakeParam {
  calls: ParamCall[] = [];
  constructor(public value = 0) {}
  private record(method: string, value: number, time: number) {
    // The real API throws on a non-finite value. Reproducing that is the whole
    // point: a bad number upstream must fail here, in a test, and not in
    // somebody's browser.
    if (!Number.isFinite(value)) throw new TypeError(`${method}: non-finite value ${value}`);
    if (!Number.isFinite(time)) throw new TypeError(`${method}: non-finite time ${time}`);
    this.calls.push({ method, value, time });
    this.value = value;
  }
  setValueAtTime(v: number, t: number) { this.record("setValueAtTime", v, t); }
  linearRampToValueAtTime(v: number, t: number) { this.record("linearRamp", v, t); }
  exponentialRampToValueAtTime(v: number, t: number) {
    // The real API throws on a target of zero for an exponential ramp.
    if (v === 0) throw new RangeError("exponentialRamp to zero");
    this.record("expRamp", v, t);
  }
  setTargetAtTime(v: number, t: number, c: number) {
    if (!Number.isFinite(c) || c <= 0) throw new RangeError(`setTargetAtTime: bad constant ${c}`);
    this.record("setTarget", v, t);
  }
}

class FakeNode {
  connections: FakeNode[] = [];
  disconnected = false;
  constructor(public kind: string, public ctx: FakeCtx) {
    ctx.nodes.push(this);
  }
  connect(t: unknown) { this.connections.push(t as FakeNode); return t; }
  disconnect() { this.disconnected = true; }
}

class FakeSource extends FakeNode {
  started: number | null = null;
  stopped: number | null = null;
  onended: (() => void) | null = null;
  loop = false;
  buffer: unknown = null;
  start(t = 0) {
    if (!Number.isFinite(t) || t < 0) throw new RangeError(`start(${t})`);
    this.started = t;
  }
  stop(t = 0) {
    if (!Number.isFinite(t) || t < 0) throw new RangeError(`stop(${t})`);
    if (this.started !== null && t < this.started) throw new RangeError("stop before start");
    this.stopped = t;
  }
}

class FakeOsc extends FakeSource {
  type = "sine";
  frequency = new FakeParam(440);
  constructor(ctx: FakeCtx) { super("osc", ctx); }
}

class FakeBufferSource extends FakeSource {
  constructor(ctx: FakeCtx) { super("buffer", ctx); }
}

class FakeGain extends FakeNode {
  gain = new FakeParam(1);
  constructor(ctx: FakeCtx) { super("gain", ctx); }
}

class FakeBiquad extends FakeNode {
  type = "lowpass";
  frequency = new FakeParam(350);
  Q = new FakeParam(1);
  constructor(ctx: FakeCtx) { super("biquad", ctx); }
}

class FakePanner extends FakeNode {
  pan = new FakeParam(0);
  constructor(ctx: FakeCtx) { super("panner", ctx); }
}

class FakeCtx {
  state = "running";
  sampleRate = 48000;
  currentTime = 1;
  destination = { kind: "destination" };
  nodes: FakeNode[] = [];
  createOscillator() { return new FakeOsc(this); }
  createGain() { return new FakeGain(this); }
  createBiquadFilter() { return new FakeBiquad(this); }
  createBufferSource() { return new FakeBufferSource(this); }
  createStereoPanner() { return new FakePanner(this); }
  createDelay() {
    const n = new FakeNode("delay", this) as FakeNode & { delayTime: FakeParam };
    n.delayTime = new FakeParam(0);
    return n;
  }
  createDynamicsCompressor() {
    const n = new FakeNode("limiter", this) as FakeNode & Record<string, FakeParam>;
    for (const p of ["threshold", "knee", "ratio", "attack", "release"]) n[p] = new FakeParam(0);
    return n;
  }
  createBuffer(_ch: number, len: number) {
    return { length: len, getChannelData: () => new Float32Array(len) };
  }
  async resume() { this.state = "running"; }
  async suspend() { this.state = "suspended"; }
  async close() { this.state = "closed"; }
}

let ctx: FakeCtx;
let engine: typeof import("@/lib/audio/engine");
let worlds: typeof import("@/lib/audio/worlds");
let speech: typeof import("@/lib/audio/speech");

beforeEach(async () => {
  vi.resetModules();
  ctx = new FakeCtx();
  const listeners: Record<string, ((e?: unknown) => void)[]> = {};
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = {
    AudioContext: function () { return ctx; },
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: number) => clearTimeout(id),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  g.document = {
    visibilityState: "visible",
    addEventListener: (k: string, fn: () => void) => {
      (listeners[k] ??= []).push(fn);
    },
    removeEventListener: () => {},
    __fire: (k: string) => (listeners[k] ?? []).forEach((f) => f()),
  };
  engine = await import("@/lib/audio/engine");
  worlds = await import("@/lib/audio/worlds");
  speech = await import("@/lib/audio/speech");
  await engine.start();
});

afterEach(() => {
  // Tear the engine down BEFORE the globals go, or a bed's pending tick timer
  // fires into a world with no `window` and throws outside any test. That
  // showed up once as a stray unhandled error on a green run, which is exactly
  // the kind of flake that gets ignored until it hides something real.
  engine.stop();
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.window;
  delete g.document;
});

const oscs = () => ctx.nodes.filter((n): n is FakeOsc => n.kind === "osc");
const sources = () => ctx.nodes.filter((n): n is FakeSource => n instanceof FakeSource);

describe("start", () => {
  it("puts a limiter last, so no stack of layers can clip the output", () => {
    const limiter = ctx.nodes.find((n) => n.kind === "limiter");
    expect(limiter).toBeTruthy();
    expect(limiter!.connections).toContain(ctx.destination as never);
  });

  it("is idempotent — a second call does not build a second graph", async () => {
    const before = ctx.nodes.length;
    await engine.start();
    expect(ctx.nodes.length).toBe(before);
  });
});

describe("mountBed", () => {
  beforeEach(() => {
    const v = worlds.SURFACE_VOICE.crucible;
    engine.mountBed("crucible", v, worlds.bedAt(v, 0.5));
  });

  it("starts every source it creates", () => {
    // A source that is built and connected but never started is silence with
    // no error anywhere — the exact class of bug nothing else here would catch.
    for (const s of sources()) expect(s.started, s.kind).not.toBeNull();
  });

  it("never writes a non-finite or negative frequency", () => {
    for (const o of oscs()) {
      expect(Number.isFinite(o.frequency.value)).toBe(true);
      expect(o.frequency.value).toBeGreaterThan(0);
    }
  });

  it("survives every intensity from 0 to 1 without throwing into a param", () => {
    const v = worlds.SURFACE_VOICE.lathe;
    for (let i = 0; i <= 1.0001; i += 0.05) {
      expect(() => engine.mountBed("lathe", v, worlds.bedAt(v, i))).not.toThrow();
    }
  });

  it("glides rather than restarting when the live numbers change", () => {
    // The bed must never be torn down to change: a poll returning new numbers
    // should be a slow shift in the room, not an audible restart.
    const v = worlds.SURFACE_VOICE.crucible;
    const before = ctx.nodes.length;
    engine.updateBed("crucible", worlds.bedAt(v, 0.9));
    expect(ctx.nodes.length).toBe(before);
    const drone = oscs()[0];
    expect(drone.stopped).toBeNull();
  });

  it("stops and disconnects everything on unmount", () => {
    engine.unmountBed("crucible");
    for (const s of sources()) expect(s.stopped, s.kind).not.toBeNull();
  });

  it("does not leak a bed when the same surface is mounted twice", () => {
    const v = worlds.SURFACE_VOICE.crucible;
    const first = sources().length;
    engine.mountBed("crucible", v, worlds.bedAt(v, 0.5));
    // The old bed's sources are stopped rather than left running under the new
    // one, which would double the level every remount.
    const stoppedCount = sources().filter((s) => s.stopped !== null).length;
    expect(stoppedCount).toBeGreaterThanOrEqual(first);
  });
});

describe("say", () => {
  const plan = () => speech.planUtterance("the kiln has gone cold again", "Kestrel", 87.3);

  it("makes no sound at all on a surface with no bed", () => {
    // Not an error — a world you are not standing in does not speak.
    const before = ctx.nodes.length;
    expect(() => engine.say("waypoint", plan(), 0)).not.toThrow();
    expect(ctx.nodes.length).toBe(before);
  });

  describe("with a bed mounted", () => {
    beforeEach(() => {
      const v = worlds.SURFACE_VOICE.crucible;
      engine.mountBed("crucible", v, worlds.bedAt(v, 0.4));
      ctx.nodes.length = 0; // only count what the utterance itself builds
    });

    it("uses one continuous source for the whole line, not one per syllable", () => {
      // A vocal tract is one source with moving resonances. Modelling it as a
      // sequence of separate beeps is both far more expensive and the reason
      // most generated speech sounds like a modem instead of a voice.
      engine.say("crucible", plan(), 0);
      expect(oscs()).toHaveLength(1);
      expect(ctx.nodes.filter((n) => n.kind === "biquad").length).toBe(3); // F1, F2, consonants
    });

    it("moves the formants and the pitch across the line", () => {
      engine.say("crucible", plan(), 0);
      const osc = oscs()[0];
      const filters = ctx.nodes.filter((n): n is FakeBiquad => n.kind === "biquad");
      const f1 = filters[0];
      expect(osc.frequency.calls.length).toBeGreaterThan(3);
      expect(f1.frequency.calls.length).toBeGreaterThan(3);
      // Real movement, not the same value written repeatedly.
      expect(new Set(f1.frequency.calls.map((c) => c.value)).size).toBeGreaterThan(1);
    });

    it("schedules strictly forward in time and stops after it finishes", () => {
      const u = plan();
      engine.say("crucible", u, 0);
      const osc = oscs()[0];
      let last = -Infinity;
      for (const c of osc.frequency.calls) {
        expect(c.time).toBeGreaterThanOrEqual(last - 1e-9);
        last = c.time;
      }
      expect(osc.stopped!).toBeGreaterThan(ctx.currentTime + u.duration);
    });

    it("places the voice where the speaker is standing", () => {
      engine.say("crucible", plan(), -0.7);
      const panner = ctx.nodes.find((n): n is FakePanner => n.kind === "panner");
      expect(panner!.pan.value).toBeCloseTo(-0.7, 6);
    });

    it("clamps a pan that came out of a projection off screen", () => {
      // Vector3.project returns values well past ±1 for anything behind the
      // camera, and StereoPannerNode throws outside its range.
      for (const p of [-40, 40, NaN as unknown as number]) {
        expect(() => engine.say("crucible", plan(), p)).not.toThrow();
      }
      for (const n of ctx.nodes.filter((x): x is FakePanner => x.kind === "panner")) {
        expect(Math.abs(n.pan.value)).toBeLessThanOrEqual(1);
      }
    });

    it("says nothing for an empty plan rather than building a dead graph", () => {
      const before = ctx.nodes.length;
      engine.say("crucible", speech.planUtterance("", "Kestrel"), 0);
      expect(ctx.nodes.length).toBe(before);
    });

    it("survives the longest line it will ever be handed", () => {
      expect(() =>
        engine.say("crucible", speech.planUtterance("a".repeat(9000), "Kestrel", 87.3), 0)
      ).not.toThrow();
    });

    it("stays silent under reduced transients", () => {
      // The steady bed is still allowed; sudden things are not. There is no
      // prefers-reduced-sound, so this borrows prefers-reduced-motion.
      engine.setReducedTransients(true);
      const before = ctx.nodes.length;
      engine.say("crucible", plan(), 0);
      engine.thunder("crucible");
      expect(ctx.nodes.length).toBe(before);
      engine.setReducedTransients(false);
    });

    it("stays silent while the context is suspended", () => {
      // Scheduling against a frozen currentTime queues everything at one
      // instant, and it all fires together the moment the tab comes back.
      ctx.state = "suspended";
      const before = ctx.nodes.length;
      engine.say("crucible", plan(), 0);
      engine.thunder("crucible");
      expect(ctx.nodes.length).toBe(before);
      ctx.state = "running";
    });
  });
});

describe("setChord", () => {
  beforeEach(() => {
    const v = worlds.SURFACE_VOICE.universe;
    engine.mountBed("universe", v, worlds.bedAt(v, 0.3));
  });

  it("sounds one note per world, at that world's own key", () => {
    const before = oscs().length;
    const notes = Object.values(worlds.ROOM_SURFACE).map((s) => ({
      id: s,
      freq: worlds.SURFACE_VOICE[s].key * 2,
      level: 0.5,
    }));
    engine.setChord("universe", notes);
    expect(oscs().length).toBe(before + 8);
    const added = oscs().slice(before);
    expect(new Set(added.map((o) => o.frequency.value)).size).toBe(8);
  });

  it("re-ramps rather than rebuilding when the activity shifts", () => {
    const notes = [{ id: "crucible", freq: 174.6, level: 0.2 }];
    engine.setChord("universe", notes);
    const n = oscs().length;
    engine.setChord("universe", [{ id: "crucible", freq: 174.6, level: 0.9 }]);
    expect(oscs().length).toBe(n);
  });

  it("lets a world with nothing happening in it be genuinely silent", () => {
    engine.setChord("universe", [{ id: "lathe", freq: 261.6, level: 0 }]);
    const gain = ctx.nodes
      .filter((g): g is FakeGain => g.kind === "gain")
      .find((g) => g.gain.calls.some((c) => c.value === 0));
    expect(gain).toBeTruthy();
  });
});

describe("the hidden tab", () => {
  it("suspends when the tab goes away and resumes when it comes back", async () => {
    engine.setMaster(0.7);
    const doc = (globalThis as unknown as { document: { visibilityState: string; __fire: (k: string) => void } }).document;
    doc.visibilityState = "hidden";
    doc.__fire("visibilitychange");
    await Promise.resolve();
    expect(ctx.state).toBe("suspended");

    doc.visibilityState = "visible";
    doc.__fire("visibilitychange");
    await Promise.resolve();
    expect(ctx.state).toBe("running");
  });

  it("stays silent on return if the visitor had muted it", async () => {
    engine.setMaster(0);
    const doc = (globalThis as unknown as { document: { visibilityState: string; __fire: (k: string) => void } }).document;
    doc.visibilityState = "hidden";
    doc.__fire("visibilitychange");
    await Promise.resolve();
    doc.visibilityState = "visible";
    doc.__fire("visibilitychange");
    await Promise.resolve();
    expect(ctx.state).toBe("suspended");
  });
});
