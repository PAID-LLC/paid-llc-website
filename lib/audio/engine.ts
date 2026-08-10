"use client";

import type { SurfaceId, SurfaceVoice, BedParams } from "./worlds";
import type { Utterance } from "./speech";

// ── The audio engine ─────────────────────────────────────────────────────────
//
// The one stateful module in lib/audio. Everything judgeable lives in the pure
// modules beside it; this is the part that owns a real AudioContext, and it is
// deliberately thin.
//
// Three rules it exists to enforce:
//
//   1. NOTHING IS CONSTRUCTED UNTIL ASKED FOR. Not a suspended context waiting
//      on a gesture — no context at all. `start()` is the only constructor and
//      it is only ever called from a click. A visitor who never touches the
//      speaker button never has an AudioContext.
//   2. A HIDDEN TAB IS SILENT. visibilitychange suspends. This is the single
//      most hated behaviour on the web and it costs four lines to never do it.
//   3. NOTHING CLIPS. Procedural synthesis with N overlapping layers has no
//      mastering engineer. A limiter sits last, and every gain change goes
//      through setTargetAtTime rather than `.value =`, or each slider move is
//      an audible click.
//
// Zero bytes of audio ship. Every sound here is generated in the browser from
// oscillators and a noise buffer, which is the same reason each world route is
// 1.52 kB: the CF Worker has no room for assets, and a 30-second stereo bed
// would be the heaviest single file on the site.

interface Bed {
  surface: SurfaceId;
  trim: GainNode;
  droneOsc: OscillatorNode;
  droneFilter: BiquadFilterNode;
  droneGain: GainNode;
  airSrc: AudioBufferSourceNode;
  airFilter: BiquadFilterNode;
  airGain: GainNode;
  airLfo: OscillatorNode;
  airLfoGain: GainNode;
  /** Weather rides on its own layer so it can be raised without touching the
   *  world's own reading of itself. */
  wxSrc: AudioBufferSourceNode;
  wxFilter: BiquadFilterNode;
  wxGain: GainNode;
  tick: { timer: number | null; params: BedParams } | null;
  /** Universe only — one sustained note per world, keyed to that world's own
   *  pitch. See setChord. */
  chord: Map<string, { osc: OscillatorNode; gain: GainNode }>;
  stopped: boolean;
}

const RAMP = 0.12; // seconds — the time constant every gain change uses

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let space: { send: GainNode } | null = null;
const beds = new Map<SurfaceId, Bed>();
const surfaceGain = new Map<SurfaceId, number>();
let reducedTransients = false;

/** Two seconds of pink noise, generated once and shared by every layer in the
 *  document. Pink rather than white because every environmental sound worth
 *  having here — wind, water, a furnace, a machine room — has more energy low
 *  than high, and white noise filtered down to taste always sounds thin. */
function pinkNoise(c: AudioContext): AudioBuffer {
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  // Paul Kellet's economy pink filter.
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.09;
    b6 = w * 0.115926;
  }
  return buf;
}

export function isRunning(): boolean {
  return ctx !== null && ctx.state === "running";
}

export function exists(): boolean {
  return ctx !== null;
}

/** Construct the context. MUST be called from inside a user gesture — browsers
 *  create a context outside one in the suspended state and it will never make
 *  a sound. Idempotent. */
export async function start(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const Ctor: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    noise = pinkNoise(ctx);

    // Limiter, last in the chain. Nothing downstream of this can clip the
    // output no matter how many layers are running.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(limiter);

    // Space, on a send. A feedback delay with a lowpass in the loop — six
    // nodes for a sense of enclosure. A ConvolverNode would sound better and
    // needs an impulse response, which is an asset, which is the one thing
    // this build cannot have.
    const send = ctx.createGain();
    send.gain.value = 0.24;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.19;
    const fb = ctx.createGain();
    fb.gain.value = 0.36;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 2100;
    send.connect(delay);
    delay.connect(damp);
    damp.connect(fb);
    fb.connect(delay);
    damp.connect(master);
    space = { send };

    document.addEventListener("visibilitychange", onVisibility);
  }
  if (ctx.state !== "running") {
    try {
      await ctx.resume();
    } catch {
      /* a context that refuses to resume stays silent; nothing else breaks */
    }
  }
}

function onVisibility() {
  if (!ctx) return;
  if (document.visibilityState === "hidden") {
    void ctx.suspend();
  } else if ((master?.gain.value ?? 0) > 0) {
    void ctx.resume();
  }
}

/** Clamp, with a fallback for anything that is not a number. Every value that
 *  reaches an AudioParam goes through this: a non-finite one throws, and a
 *  thrown TypeError mid-graph leaves half a signal chain connected and
 *  silent — a failure that is much harder to notice than a loud one. */
function safe(v: number, fallback: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return fallback;
  return v < lo ? lo : v > hi ? hi : v;
}

function ramp(p: AudioParam, to: number, at: number) {
  p.setTargetAtTime(safe(to, 0, -1e6, 1e6), at, RAMP);
}

/** The master level. Zero is a real mute: every bed's trim is multiplied by it
 *  so no layer can leak past. */
export function setMaster(level: number) {
  if (!ctx || !master) return;
  ramp(master.gain, Math.max(0, Math.min(1, level)), ctx.currentTime);
}

export function setSurfaceLevel(surface: SurfaceId, level: number) {
  const v = Math.max(0, Math.min(1, level));
  surfaceGain.set(surface, v);
  const bed = beds.get(surface);
  if (bed && ctx) ramp(bed.trim.gain, v, ctx.currentTime);
}

/** Under prefers-reduced-motion every transient is suppressed — thunder,
 *  speech bursts, ticks. The steady bed still plays if it was explicitly
 *  asked for. There is no prefers-reduced-sound to read; this is the closest
 *  available signal for "this visitor wants a calmer page", and borrowing it
 *  is a judgement call rather than a standard. */
export function setReducedTransients(on: boolean) {
  reducedTransients = on;
}

// ── Beds ─────────────────────────────────────────────────────────────────────

export function mountBed(surface: SurfaceId, voice: SurfaceVoice, params: BedParams) {
  if (!ctx || !master || !noise) return;
  unmountBed(surface);
  const c = ctx;
  const now = c.currentTime;

  const trim = c.createGain();
  trim.gain.value = surfaceGain.get(surface) ?? 0.8;
  trim.connect(master);
  if (space) trim.connect(space.send);

  // Drone: a filtered sine an octave under the surface's key. This is the
  // layer that decides whether a place feels enclosed before you have
  // identified a single sound in it.
  const droneOsc = c.createOscillator();
  droneOsc.type = "sine";
  droneOsc.frequency.value = params.droneFreq;
  const droneFilter = c.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.value = params.droneFreq * 6;
  droneFilter.Q.value = params.droneQ;
  const droneGain = c.createGain();
  droneGain.gain.value = 0;
  droneOsc.connect(droneFilter);
  droneFilter.connect(droneGain);
  droneGain.connect(trim);
  droneOsc.start();
  ramp(droneGain.gain, params.droneGain, now);

  // Air: looped pink noise through a bandpass whose centre is walked by an
  // LFO. Wind, water, furnace roar and machine-room hum are all this one
  // primitive at different settings.
  const airSrc = c.createBufferSource();
  airSrc.buffer = noise;
  airSrc.loop = true;
  const airFilter = c.createBiquadFilter();
  airFilter.type = "bandpass";
  airFilter.frequency.value = params.airBand;
  airFilter.Q.value = params.airWidth;
  const airGain = c.createGain();
  airGain.gain.value = 0;
  const airLfo = c.createOscillator();
  airLfo.type = "sine";
  airLfo.frequency.value = params.airMotion;
  const airLfoGain = c.createGain();
  airLfoGain.gain.value = params.airBand * 0.35;
  airLfo.connect(airLfoGain);
  airLfoGain.connect(airFilter.frequency);
  airSrc.connect(airFilter);
  airFilter.connect(airGain);
  airGain.connect(trim);
  airSrc.start();
  airLfo.start();
  ramp(airGain.gain, params.airGain, now);

  // Weather: its own layer, so a storm can be loud without altering the
  // world's reading of its own activity.
  const wxSrc = c.createBufferSource();
  wxSrc.buffer = noise;
  wxSrc.loop = true;
  const wxFilter = c.createBiquadFilter();
  wxFilter.type = "bandpass";
  wxFilter.frequency.value = 900;
  wxFilter.Q.value = 0.6;
  const wxGain = c.createGain();
  wxGain.gain.value = 0;
  wxSrc.connect(wxFilter);
  wxFilter.connect(wxGain);
  wxGain.connect(trim);
  wxSrc.start();

  const bed: Bed = {
    surface,
    trim,
    droneOsc,
    droneFilter,
    droneGain,
    airSrc,
    airFilter,
    airGain,
    airLfo,
    airLfoGain,
    wxSrc,
    wxFilter,
    wxGain,
    tick: params.tickRate > 0 ? { timer: null, params } : null,
    chord: new Map(),
    stopped: false,
  };
  beds.set(surface, bed);
  if (bed.tick) scheduleTick(bed);
}

/**
 * The universe's chord: one sustained sine per world, at that world's own key,
 * with its level set by that world's real activity.
 *
 * The star map is not a place, so a place's bed would be the wrong sound for
 * it. What it is, is the sum of the worlds — so it is played as one. A busy
 * world is audible in the chord before you visit it, and a world with nothing
 * happening in it is genuinely silent, exactly as its dark planet already
 * shows. This is the one surface with a fourth layer, and it earns it by being
 * the only surface whose subject is the other surfaces.
 *
 * Notes are created once and then only ever re-ramped, so a poll shifts the
 * balance of the chord rather than restarting it.
 */
export function setChord(surface: SurfaceId, notes: { id: string; freq: number; level: number }[]) {
  const bed = beds.get(surface);
  if (!bed || !ctx) return;
  const c = ctx;
  const now = c.currentTime;
  for (const n of notes) {
    let voice = bed.chord.get(n.id);
    if (!voice) {
      const osc = c.createOscillator();
      osc.type = "sine";
      osc.frequency.value = n.freq;
      const gain = c.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(bed.trim);
      osc.start();
      voice = { osc, gain };
      bed.chord.set(n.id, voice);
    }
    ramp(voice.gain.gain, Math.max(0, Math.min(1, n.level)) * 0.09, now);
  }
}

/** Sparse discrete events — sparks, drips, hull knocks. Scheduled one at a
 *  time rather than through a lookahead scheduler because these are random and
 *  seconds apart; a lookahead buys nothing and would keep a timer hot. The
 *  suspended-context guard matters: currentTime freezes while suspended, so
 *  without it a backgrounded tab would queue events at one instant and fire
 *  them all together on resume. */
function scheduleTick(bed: Bed) {
  if (!ctx || bed.stopped || !bed.tick) return;
  const rate = bed.tick.params.tickRate;
  if (rate <= 0) return;
  // Exponential inter-arrival: real sparse events cluster, evenly spaced ones
  // read as a metronome.
  const wait = (-Math.log(1 - Math.random()) / rate) * 1000;
  bed.tick.timer = window.setTimeout(() => {
    if (!ctx || bed.stopped || !bed.tick) return;
    if (ctx.state === "running" && !reducedTransients) {
      const p = bed.tick.params;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(p.tickFreq * (0.9 + Math.random() * 0.25), t);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, p.tickFreq * 0.55),
        t + p.tickDecay
      );
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(p.tickGain, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p.tickDecay);
      osc.connect(g);
      g.connect(bed.trim);
      osc.start(t);
      osc.stop(t + p.tickDecay + 0.05);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
      };
    }
    scheduleTick(bed);
  }, Math.min(wait, 30_000));
}

/** Rebind a mounted bed to new live numbers. Everything glides; nothing is
 *  torn down and rebuilt, which is what would make a poll audible. */
export function updateBed(surface: SurfaceId, params: BedParams) {
  const bed = beds.get(surface);
  if (!bed || !ctx) return;
  const now = ctx.currentTime;
  ramp(bed.droneGain.gain, params.droneGain, now);
  ramp(bed.airFilter.frequency, params.airBand, now);
  ramp(bed.airGain.gain, params.airGain, now);
  ramp(bed.airLfo.frequency, params.airMotion, now);
  ramp(bed.airLfoGain.gain, params.airBand * 0.35, now);
  if (bed.tick) bed.tick.params = params;
}

/** severity 0..1 raises the wind; `band` shifts its character (rain is bright,
 *  a dust front is dark). */
export function setWeather(surface: SurfaceId, severity: number, band: number) {
  const bed = beds.get(surface);
  if (!bed || !ctx) return;
  const s = Math.max(0, Math.min(1, severity));
  const now = ctx.currentTime;
  ramp(bed.wxFilter.frequency, band, now);
  ramp(bed.wxGain.gain, s * 0.3, now);
}

/** A storm flash. Suppressed under reduced transients — a bang nobody asked
 *  for is exactly the startle that setting is there to prevent. */
export function thunder(surface: SurfaceId) {
  const bed = beds.get(surface);
  if (!bed || !ctx || !noise || reducedTransients || ctx.state !== "running") return;
  const c = ctx;
  const t = c.currentTime + 0.05;
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(420, t);
  f.frequency.exponentialRampToValueAtTime(90, t + 1.6);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.42, t + 0.09);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
  src.connect(f);
  f.connect(g);
  g.connect(bed.trim);
  src.start(t);
  src.stop(t + 1.9);
  src.onended = () => {
    src.disconnect();
    f.disconnect();
    g.disconnect();
  };
}

export function unmountBed(surface: SurfaceId) {
  const bed = beds.get(surface);
  if (!bed) return;
  bed.stopped = true;
  if (bed.tick?.timer !== null && bed.tick?.timer !== undefined) {
    window.clearTimeout(bed.tick.timer);
  }
  const stopAt = ctx ? ctx.currentTime + 0.3 : 0;
  if (ctx) ramp(bed.trim.gain, 0, ctx.currentTime);
  const sources: (OscillatorNode | AudioBufferSourceNode)[] = [
    bed.droneOsc,
    bed.airSrc,
    bed.airLfo,
    bed.wxSrc,
    ...Array.from(bed.chord.values()).map((v) => v.osc),
  ];
  for (const n of sources) {
    try {
      n.stop(stopAt);
    } catch {
      /* already stopped */
    }
  }
  bed.chord.clear();
  window.setTimeout(() => bed.trim.disconnect(), 500);
  beds.delete(surface);
}

// ── Speech ───────────────────────────────────────────────────────────────────

/**
 * Say one planned utterance on a surface.
 *
 * One oscillator for the whole line, with the pitch stepping and the two
 * formant filters sliding at each syllable boundary. That is both far cheaper
 * than a node graph per syllable and a better model of the thing being
 * imitated: a vocal tract is one continuous source with moving resonances, not
 * a sequence of separate beeps, and the continuity is most of what makes this
 * read as language rather than as a modem.
 *
 * @param pan -1..1, the speaker's real position on screen.
 */
export function say(surface: SurfaceId, u: Utterance, pan = 0, level = 1) {
  const bed = beds.get(surface);
  if (!bed || !ctx || !noise || reducedTransients || ctx.state !== "running") return;
  if (u.syllables.length === 0) return;
  const c = ctx;
  const t0 = c.currentTime + 0.03;

  const osc = c.createOscillator();
  osc.type = u.voice.timbre > 0.5 ? "square" : "sawtooth";
  const f1 = c.createBiquadFilter();
  f1.type = "bandpass";
  f1.Q.value = 8;
  const f2 = c.createBiquadFilter();
  f2.type = "bandpass";
  f2.Q.value = 12;
  const f2Gain = c.createGain();
  f2Gain.gain.value = 0.55; // the second formant sits under the first
  const env = c.createGain();
  env.gain.value = 0;
  const panner = c.createStereoPanner();
  // NaN survives Math.min/Math.max, and a non-finite AudioParam value throws
  // and takes the whole utterance with it. The pan arrives from
  // Vector3.project(), which is NaN for a degenerate camera and well past ±1
  // for anything behind it — so the guard belongs here, where the number meets
  // the API, not only at the call site.
  panner.pan.value = safe(pan, 0, -1, 1);
  const out = c.createGain();
  out.gain.value = safe(level, 1, 0, 1) * 0.5;

  osc.connect(f1);
  osc.connect(f2);
  f1.connect(env);
  f2.connect(f2Gain);
  f2Gain.connect(env);
  env.connect(panner);
  panner.connect(out);
  out.connect(bed.trim);

  // The consonant layer: noise, gated open only at onsets that call for it.
  const nz = c.createBufferSource();
  nz.buffer = noise;
  nz.loop = true;
  const nzFilter = c.createBiquadFilter();
  nzFilter.type = "bandpass";
  nzFilter.frequency.value = 3200;
  nzFilter.Q.value = 1.4;
  const nzGain = c.createGain();
  nzGain.gain.value = 0;
  nz.connect(nzFilter);
  nzFilter.connect(nzGain);
  nzGain.connect(panner);

  let t = t0;
  osc.frequency.setValueAtTime(u.syllables[0].pitch, t);
  f1.frequency.setValueAtTime(u.syllables[0].f1, t);
  f2.frequency.setValueAtTime(u.syllables[0].f2, t);

  for (const s of u.syllables) {
    // A short glide into each pitch rather than a jump: speech does not step.
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, s.pitch), t + 0.02);
    f1.frequency.setTargetAtTime(s.f1, t, 0.015);
    f2.frequency.setTargetAtTime(s.f2, t, 0.02);

    env.gain.setTargetAtTime(s.gain, t, Math.max(0.004, s.attack));
    // The floor between syllables is 18% rather than zero — the overlap is
    // what links the sounds into a line instead of a list.
    env.gain.setTargetAtTime(s.gain * 0.18, t + s.duration * 0.62, 0.03);

    if (s.onset === "plosive" || s.onset === "fricative") {
      const burst = s.onset === "plosive" ? 0.018 : 0.045;
      nzFilter.frequency.setValueAtTime(s.onset === "plosive" ? 1800 : 4600, t);
      nzGain.gain.setValueAtTime(0, Math.max(t0, t - 0.02));
      nzGain.gain.linearRampToValueAtTime(s.onset === "plosive" ? 0.1 : 0.055, t);
      nzGain.gain.exponentialRampToValueAtTime(0.0001, t + burst);
    }
    t += s.duration + 0.012;
  }

  env.gain.setTargetAtTime(0, t, 0.05);
  const end = t + 0.35;
  osc.start(t0);
  nz.start(t0);
  osc.stop(end);
  nz.stop(end);
  osc.onended = () => {
    for (const n of [osc, f1, f2, f2Gain, env, panner, out, nz, nzFilter, nzGain]) {
      n.disconnect();
    }
  };
}

/** Full teardown. Only used when the whole page is going away. */
export function stop() {
  for (const s of Array.from(beds.keys())) unmountBed(s);
  if (ctx) {
    document.removeEventListener("visibilitychange", onVisibility);
    void ctx.close();
  }
  ctx = null;
  master = null;
  noise = null;
  space = null;
}
