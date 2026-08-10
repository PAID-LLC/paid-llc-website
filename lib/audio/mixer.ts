// ── Mixer settings ───────────────────────────────────────────────────────────
//
// Pure. Parsing, clamping and serialising the visitor's audio preferences.
// Kept out of the React store so the awkward half — a corrupt or hostile blob
// in localStorage, a value from an older schema, a number that is not a number
// — is decidable in a unit test rather than at 2am in somebody's browser.
//
// The default is SILENCE. Not "quiet", not "suspended and ready" — off, with no
// AudioContext in existence. Two independent reasons converge on it:
//
//   1. WCAG 2.2 SC 1.4.2 (Level A): audio that plays automatically for over
//      three seconds must offer a stop mechanism or independent volume control.
//      Never playing automatically clears the bar outright, and we ship the
//      controls anyway.
//   2. Browsers construct an AudioContext in the suspended state unless a user
//      gesture preceded it, so opt-in is the only design that works regardless.

export const STORAGE_KEY = "latent_audio_v1";

export interface AudioSettings {
  /** The master mute. False on a first visit and after any parse failure. */
  enabled: boolean;
  /** "The universe" slider — the level everything passes through. */
  master: number;
  /** Per-surface trim, keyed by surface id. Absent means DEFAULT_WORLD. */
  worlds: Record<string, number>;
}

export const DEFAULT_MASTER = 0.7;
export const DEFAULT_WORLD = 0.8;

export const DEFAULT_SETTINGS: AudioSettings = {
  enabled: false,
  master: DEFAULT_MASTER,
  worlds: {},
};

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Parse whatever came out of storage. Never throws, never trusts a field.
 *  Anything unrecognised falls back to the default rather than to a louder
 *  value — the failure mode of an audio setting must always be quieter. */
export function parseSettings(raw: string | null): AudioSettings {
  if (!raw) return { ...DEFAULT_SETTINGS, worlds: {} };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS, worlds: {} };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ...DEFAULT_SETTINGS, worlds: {} };
  }
  const o = data as Record<string, unknown>;

  const worlds: Record<string, number> = {};
  const w = o.worlds;
  if (w && typeof w === "object" && !Array.isArray(w)) {
    for (const [k, v] of Object.entries(w as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) worlds[k] = clamp01(v);
    }
  }

  return {
    enabled: o.enabled === true,
    master: typeof o.master === "number" ? clamp01(o.master) : DEFAULT_MASTER,
    worlds,
  };
}

export function serialiseSettings(s: AudioSettings): string {
  return JSON.stringify({
    enabled: s.enabled === true,
    master: clamp01(s.master),
    worlds: Object.fromEntries(
      Object.entries(s.worlds).map(([k, v]) => [k, clamp01(v)])
    ),
  });
}

/** The trim for one surface. Unset surfaces sit at DEFAULT_WORLD rather than
 *  silent, so a world that ships after the visitor last touched the mixer is
 *  audible instead of mysteriously mute. */
export function worldGain(s: AudioSettings, surface: string): number {
  const v = s.worlds[surface];
  return typeof v === "number" ? clamp01(v) : DEFAULT_WORLD;
}

/** What the engine actually applies to a surface's bus. Muted is exactly zero,
 *  not a small number — a slider left at 1% must not leak sound past a mute. */
export function effectiveGain(s: AudioSettings, surface: string): number {
  if (!s.enabled) return 0;
  return clamp01(s.master) * worldGain(s, surface);
}
