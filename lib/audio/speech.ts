import { hashStr, mulberry32 } from "@/lib/sim-field";

// ── What an agent sounds like ────────────────────────────────────────────────
//
// Residents already speak: lib/residents/society.ts composes real lines, the
// tick writes them, and Inhabitant.tsx renders them as bubbles. This module
// turns one of those real lines into something you can hear.
//
// It is PURE. It plans an utterance; it does not make a sound. Everything that
// could be wrong about the result — determinism, timing, the mapping from
// letters to formants, the behaviour on pathological input — is decidable in a
// unit test, which matters more than usual here because nothing in this
// environment can listen to the output.
//
// The design, and why it is not a random blip generator:
//
//   The message chooses the sound. Syllables are cut at vowel runs in the real
//   body text, and each syllable's vowel selects a first and second formant off
//   the standard vowel table. A line full of "ee" is bright; a line full of
//   "oh" is dark. The listener receives the same information the reader gets
//   from the bubble, in another channel. That makes the audio a RENDERING of
//   the message rather than decoration over it, which is the same standard the
//   rest of these worlds are held to.
//
//   The speaker chooses the voice. Base pitch, formant scale, timbre and rate
//   all derive from the agent's name through the house hashStr/mulberry32 pair,
//   exactly like every position in every world. The same agent always sounds
//   like itself, and two agents in a conversation are audibly two speakers.
//
//   Consonants are never synthesised. They shape the attack of the vowel that
//   follows, which is what they actually do in speech: a plosive snaps, a
//   fricative hisses ahead of the vowel, a nasal is soft and drops F1. Six
//   filters and an envelope, no sample set.

/** Standard vowel formants (Peterson & Barney, adult male reference), keyed by
 *  the English letter most likely to be spelling them. F3 is not modelled: two
 *  peaks is enough to hear a vowel, and the third costs a filter per syllable
 *  for a distinction nobody makes at this duration. */
const VOWELS: Record<string, [number, number]> = {
  a: [660, 1720], // æ  had
  e: [530, 1840], // ɛ  head
  i: [390, 1990], // ɪ  hid
  o: [570, 840], //  ɔ  hawed
  u: [640, 1190], // ʌ  hud
  y: [390, 1990], // treated as i
};

const VOWEL_LETTERS = "aeiouy";

/** Plosives snap, fricatives hiss, nasals soften. Anything else is neutral. */
const PLOSIVE = "ptkbdg";
const FRICATIVE = "sfhzv";
const NASAL = "mn";

export type Onset = "plosive" | "fricative" | "nasal" | "neutral";

export interface Syllable {
  /** Attack in seconds. A plosive is a snap; a nasal eases in. */
  attack: number;
  /** How the syllable starts, which decides whether a noise tick is layered. */
  onset: Onset;
  /** Formant pair in Hz, already scaled by the speaker's tract length. */
  f1: number;
  f2: number;
  /** Pitch in Hz, quantised to the surface's scale. */
  pitch: number;
  /** Seconds. */
  duration: number;
  /** 0..1 relative level. Stressed syllables are louder. */
  gain: number;
}

export interface Voice {
  /** Root pitch in Hz before scale quantisation. */
  base: number;
  /** Notional vocal-tract length. Below 1 is longer and darker. */
  formantScale: number;
  /** 0 = pure sawtooth (reedy), 1 = square-ish (hollow). */
  timbre: number;
  /** Multiplies syllable duration. */
  rate: number;
}

export interface Utterance {
  syllables: Syllable[];
  voice: Voice;
  /** Total seconds, including inter-syllable gaps. */
  duration: number;
}

/** A syllable never runs long enough to become a note, and an utterance never
 *  runs long enough to become a drone. A resident with a lot to say gets cut
 *  off, which is preferable to a world that hums at you. */
export const MAX_SYLLABLES = 14;
export const MAX_DURATION = 2.5;

const BASE_SYLLABLE = 0.075;
const GAP = 0.012;

/** Pentatonic minor, as semitone offsets. Every pitch in every utterance snaps
 *  to this, rooted on the surface's own key, so a crowd speaking at once is
 *  consonant instead of a pile-up — and each world's speech sits in a
 *  different key. */
const SCALE = [0, 3, 5, 7, 10];

function quantise(hz: number, root: number): number {
  // Nearest scale degree in the octave the raw pitch already lands in.
  const semis = 12 * Math.log2(Math.max(hz, 1) / root);
  const octave = Math.floor(semis / 12);
  const within = semis - octave * 12;
  let best = SCALE[0];
  let bestGap = Infinity;
  for (const s of SCALE) {
    const gap = Math.abs(s - within);
    if (gap < bestGap) {
      bestGap = gap;
      best = s;
    }
  }
  return root * Math.pow(2, (octave * 12 + best) / 12);
}

/** Deterministic per agent: the same name always sounds like the same speaker,
 *  on every render, every poll and every visit. */
export function voiceFor(speaker: string): Voice {
  const rand = mulberry32(hashStr(`latent-voice-${speaker}`));
  return {
    base: 150 + rand() * 270,
    formantScale: 0.85 + rand() * 0.35,
    timbre: rand(),
    rate: 0.85 + rand() * 0.3,
  };
}

function onsetOf(consonants: string): Onset {
  if (!consonants) return "neutral";
  const last = consonants[consonants.length - 1];
  if (PLOSIVE.includes(last)) return "plosive";
  if (FRICATIVE.includes(last)) return "fricative";
  if (NASAL.includes(last)) return "nasal";
  return "neutral";
}

const ATTACK: Record<Onset, number> = {
  plosive: 0.003,
  fricative: 0.012,
  nasal: 0.025,
  neutral: 0.008,
};

interface RawSyllable {
  onset: Onset;
  vowel: string;
  /** Length of the vowel run — "oo" holds longer than "o". */
  weight: number;
}

/** Cut the real text at vowel runs. Consonants between vowels attach to the
 *  syllable they precede, which is where they belong acoustically. */
function syllabify(text: string): RawSyllable[] {
  const out: RawSyllable[] = [];
  let consonants = "";
  let i = 0;
  const s = text.toLowerCase();

  while (i < s.length && out.length < MAX_SYLLABLES) {
    const ch = s[i];
    if (ch >= "a" && ch <= "z") {
      if (VOWEL_LETTERS.includes(ch)) {
        let run = "";
        while (i < s.length && VOWEL_LETTERS.includes(s[i])) {
          run += s[i];
          i++;
        }
        out.push({ onset: onsetOf(consonants), vowel: run[0], weight: run.length });
        consonants = "";
      } else {
        consonants += ch;
        i++;
      }
    } else {
      i++;
    }
  }

  // A word with no vowels at all ("hmm", "psst", an all-consonant token) still
  // gets a voice. Muttering is the honest rendering: something was said.
  if (out.length === 0 && consonants) {
    out.push({ onset: onsetOf(consonants), vowel: "u", weight: 1 });
  }
  return out;
}

/** Where the line is going, read off its real punctuation. A question rises. */
function contour(text: string): number {
  const end = text.trimEnd().slice(-1);
  if (end === "?") return 1;
  if (end === "!") return 0.4;
  return -1;
}

/**
 * Plan one utterance. Pure: same inputs, same plan, forever.
 *
 * @param text    the resident's real message body
 * @param speaker the resident's name, which fixes the voice
 * @param root    the surface's key in Hz — pitches quantise to a pentatonic
 *                minor scale on this, so each world speaks in its own key
 */
export function planUtterance(text: string, speaker: string, root = 110): Utterance {
  const voice = voiceFor(speaker);
  const raw = syllabify(text);
  const rand = mulberry32(hashStr(`latent-line-${speaker}:${text}`));
  const dir = contour(text);

  const syllables: Syllable[] = [];
  let total = 0;

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const [f1, f2] = VOWELS[r.vowel] ?? VOWELS.u;
    const progress = raw.length > 1 ? i / (raw.length - 1) : 0;

    // Intonation: drift across the line in the direction the punctuation
    // implies, plus a small deterministic wobble so a long line does not walk
    // a perfectly straight ramp.
    //
    // 0.26 rather than something subtler because every pitch is quantised
    // afterwards, and a pentatonic step is 2-3 semitones: a contour smaller
    // than one step rounds away to nothing and the question mark stops being
    // audible at all. This lands about four semitones up on a question and
    // five down on a statement, which is ordinary speech.
    const drift = 1 + dir * 0.26 * progress;
    const wobble = 0.94 + rand() * 0.12;

    // The last syllable before terminal punctuation carries the stress, and
    // the first syllable of a line is naturally a little stronger.
    const stressed = i === raw.length - 1 || i === 0;

    const duration =
      BASE_SYLLABLE * voice.rate * (0.8 + r.weight * 0.25) * (0.9 + rand() * 0.3);

    if (total + duration > MAX_DURATION) break;

    syllables.push({
      attack: ATTACK[r.onset],
      onset: r.onset,
      // A nasal drops F1 — that is the acoustic signature of a closed mouth.
      f1: f1 * voice.formantScale * (r.onset === "nasal" ? 0.78 : 1),
      f2: f2 * voice.formantScale,
      pitch: quantise(voice.base * drift * wobble, root),
      duration,
      gain: stressed ? 1 : 0.72 + rand() * 0.18,
    });
    total += duration + GAP;
  }

  return { syllables, voice, duration: Math.max(0, total - GAP) };
}
