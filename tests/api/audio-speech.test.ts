/**
 * Tests for lib/audio/speech.ts — what an agent sounds like.
 *
 * These carry more than usual weight. Nothing in this environment can listen
 * to the output: the render harness is headless Chrome with software WebGL and
 * no audio device, and there is no screenshot for a sound. So the whole
 * judgeable surface was pushed into this pure module deliberately, and what is
 * NOT covered here — whether it actually sounds good — is Travis's call on real
 * hardware and is reported as unverified rather than claimed.
 */

import { describe, expect, it } from "vitest";
import {
  MAX_DURATION,
  MAX_SYLLABLES,
  planUtterance,
  voiceFor,
} from "@/lib/audio/speech";

describe("voiceFor", () => {
  it("gives the same agent the same voice, every time", () => {
    expect(voiceFor("Kestrel")).toEqual(voiceFor("Kestrel"));
  });

  it("gives different agents different voices", () => {
    // Two residents in a conversation have to be audibly two speakers, or the
    // whole point of sourcing the voice from the name is lost.
    const a = voiceFor("Kestrel");
    const b = voiceFor("Sable");
    expect(a.base).not.toBeCloseTo(b.base, 1);
  });

  it("keeps every voice in a range a listener reads as a voice", () => {
    for (const n of ["a", "Kestrel", "paid-ops-1", "gpt-5-mini", "üñîçø∂é", "x".repeat(200)]) {
      const v = voiceFor(n);
      expect(v.base).toBeGreaterThanOrEqual(150);
      expect(v.base).toBeLessThanOrEqual(420);
      expect(v.formantScale).toBeGreaterThan(0.8);
      expect(v.formantScale).toBeLessThan(1.25);
      expect(v.rate).toBeGreaterThan(0.8);
      expect(v.rate).toBeLessThan(1.2);
      expect(v.timbre).toBeGreaterThanOrEqual(0);
      expect(v.timbre).toBeLessThanOrEqual(1);
    }
  });
});

describe("planUtterance", () => {
  it("is deterministic for the same line from the same speaker", () => {
    const a = planUtterance("the kiln is cold again", "Kestrel");
    const b = planUtterance("the kiln is cold again", "Kestrel");
    expect(a).toEqual(b);
  });

  it("says different lines differently", () => {
    // Not by syllable COUNT — two unrelated sentences land on six syllables
    // often enough that the count proves nothing. The plan is the claim.
    const a = planUtterance("the kiln is cold again", "Kestrel");
    const b = planUtterance("the survey found nothing", "Kestrel");
    expect(a.syllables).not.toEqual(b.syllables);
  });

  it("says the same line differently in two mouths", () => {
    const a = planUtterance("the kiln is cold", "Kestrel");
    const b = planUtterance("the kiln is cold", "Sable");
    expect(a.syllables[0].pitch).not.toBeCloseTo(b.syllables[0].pitch, 2);
  });
});

describe("the message chooses the sound", () => {
  it("reads the vowels out of the real text", () => {
    // This is the claim that makes the audio a rendering of the message rather
    // than decoration over it: a line full of "ee" is bright, a line full of
    // "oh" is dark, and a listener is getting the same information a reader
    // gets from the bubble.
    const bright = planUtterance("mimicry is distinct", "Kestrel");
    const dark = planUtterance("no bronze door holds", "Kestrel");
    const meanF2 = (u: ReturnType<typeof planUtterance>) =>
      u.syllables.reduce((s, x) => s + x.f2, 0) / u.syllables.length;
    expect(meanF2(bright)).toBeGreaterThan(meanF2(dark) * 1.5);
  });

  it("cuts syllables at vowel runs, not at characters", () => {
    // One syllable per vowel run. "queue" is one run of four vowels, not four
    // separate blips — which is exactly the difference between speech and a
    // modem.
    expect(planUtterance("queue", "K").syllables).toHaveLength(1);
    expect(planUtterance("banana", "K").syllables).toHaveLength(3);
  });

  it("shapes the attack by the consonant in front of the vowel", () => {
    // Consonants are never synthesised — they shape the vowel that follows,
    // which is what they actually do in speech.
    const plosive = planUtterance("ta", "K").syllables[0];
    const nasal = planUtterance("ma", "K").syllables[0];
    const fricative = planUtterance("sa", "K").syllables[0];
    expect(plosive.onset).toBe("plosive");
    expect(nasal.onset).toBe("nasal");
    expect(fricative.onset).toBe("fricative");
    expect(plosive.attack).toBeLessThan(nasal.attack);
  });

  it("drops F1 on a nasal, because a closed mouth really does", () => {
    const nasal = planUtterance("ma", "K").syllables[0];
    const plain = planUtterance("la", "K").syllables[0];
    expect(nasal.f1).toBeLessThan(plain.f1);
  });

  it("takes its intonation from real punctuation", () => {
    const asked = planUtterance("did the kiln go cold again today?", "K");
    const told = planUtterance("did the kiln go cold again today.", "K");
    const last = (u: ReturnType<typeof planUtterance>) => u.syllables[u.syllables.length - 1].pitch;
    expect(last(asked)).toBeGreaterThan(last(told));
  });
});

describe("pathological input", () => {
  it("says nothing for an empty line rather than throwing", () => {
    const u = planUtterance("", "Kestrel");
    expect(u.syllables).toHaveLength(0);
    expect(u.duration).toBe(0);
  });

  it("mutters for a line with no vowels at all", () => {
    // "hmm", "psst", an all-consonant token. Something was said, so something
    // is heard; silence here would read as a dropped message.
    const u = planUtterance("hmm", "Kestrel");
    expect(u.syllables.length).toBeGreaterThan(0);
  });

  it("says nothing for punctuation and emoji only", () => {
    expect(planUtterance("!!! ??? ...", "K").syllables).toHaveLength(0);
    expect(planUtterance("🙂🙂🙂", "K").syllables).toHaveLength(0);
  });

  it("never drones, whatever it is handed", () => {
    // A 10 kB message must not become a 40-second monologue over a world.
    for (const text of ["a".repeat(10_000), "the ".repeat(4_000), "aeiou ".repeat(900)]) {
      const u = planUtterance(text, "Kestrel");
      expect(u.syllables.length).toBeLessThanOrEqual(MAX_SYLLABLES);
      expect(u.duration).toBeLessThanOrEqual(MAX_DURATION);
    }
  });

  it("keeps a real line inside a couple of seconds", () => {
    const u = planUtterance(
      "The kiln has been cold for two days and nobody has come to look at it.",
      "Kestrel"
    );
    expect(u.duration).toBeGreaterThan(0.3);
    expect(u.duration).toBeLessThanOrEqual(MAX_DURATION);
  });

  it("emits only finite, positive, audible numbers", () => {
    for (const text of ["", "hmm", "a", "The kiln is cold.", "x".repeat(500)]) {
      for (const s of planUtterance(text, "Kestrel").syllables) {
        for (const [k, v] of Object.entries(s)) {
          if (typeof v !== "number") continue;
          expect(Number.isFinite(v), `${k} on "${text}"`).toBe(true);
          expect(v, `${k} on "${text}"`).toBeGreaterThan(0);
        }
        // A pitch outside hearing is a bug that is silent instead of loud,
        // which is the hardest kind to notice.
        expect(s.pitch).toBeGreaterThan(40);
        expect(s.pitch).toBeLessThan(4000);
        expect(s.gain).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("the world's key", () => {
  it("puts each world's speech in its own key", () => {
    // Pitches quantise to a pentatonic minor scale on the surface root, so a
    // crowd is consonant rather than a pile-up, and the Crucible and the Lathe
    // do not sound like the same room.
    const a = planUtterance("the kiln is cold", "Kestrel", 87);
    const b = planUtterance("the kiln is cold", "Kestrel", 123);
    expect(a.syllables[0].pitch).not.toBeCloseTo(b.syllables[0].pitch, 2);
  });

  it("quantises onto the scale rather than anywhere between", () => {
    const root = 110;
    const allowed = [0, 3, 5, 7, 10];
    for (const s of planUtterance("the kiln has gone cold again", "Kestrel", root).syllables) {
      const semis = 12 * Math.log2(s.pitch / root);
      const within = ((semis % 12) + 12) % 12;
      const hit = allowed.some((a) => Math.abs(within - a) < 1e-6 || Math.abs(within - a - 12) < 1e-6);
      expect(hit, `pitch ${s.pitch} is off the scale (${within} semitones)`).toBe(true);
    }
  });
});
