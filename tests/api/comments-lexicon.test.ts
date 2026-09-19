/**
 * Tests for the sentiment lexicon (lib/comments/lexicon.ts).
 *
 * Why this file exists: this module replaces what would otherwise be ~5,000
 * Gemini calls a day. That trade is only defensible if the scoring is actually
 * right about the things a comment section does constantly — negating, shouting,
 * using "sick" as praise — so those cases are pinned here rather than assumed.
 *
 * These are not accuracy benchmarks. They lock the properties the page's claims
 * depend on: output stays in range, negation flips, intensity scales, and
 * isLikelyEnglish keeps unscorable sections out of the publication.
 */

import { describe, it, expect } from "vitest";
import {
  scoreSentiment,
  labelOf,
  tokenize,
  extractEmoji,
  isLikelyEnglish,
} from "@/lib/comments/lexicon";

describe("scoreSentiment — direction", () => {
  it("scores plain praise positive and plain criticism negative", () => {
    expect(scoreSentiment("this was absolutely brilliant")).toBeGreaterThan(0.15);
    expect(scoreSentiment("this was terrible")).toBeLessThan(-0.15);
  });

  it("treats comment-section slang with its comment-section meaning", () => {
    // "sick", "insane" and "goat" are praise here, the opposite of the
    // dictionary sense. Getting these backwards would invert whole sections.
    expect(scoreSentiment("this is sick")).toBeGreaterThan(0);
    expect(scoreSentiment("absolute goat behaviour")).toBeGreaterThan(0);
    expect(scoreSentiment("this is mid")).toBeLessThan(0);
    expect(scoreSentiment("total cringe")).toBeLessThan(0);
  });

  it("returns 0 for text containing nothing scorable", () => {
    expect(scoreSentiment("the video starts at 3:15")).toBe(0);
    expect(scoreSentiment("")).toBe(0);
    expect(scoreSentiment("   ")).toBe(0);
  });
});

describe("scoreSentiment — negation", () => {
  it("flips polarity", () => {
    expect(scoreSentiment("not good")).toBeLessThan(0);
    expect(scoreSentiment("this is not terrible")).toBeGreaterThan(0);
  });

  it("dampens rather than mirrors, so 'not great' is milder than 'terrible'", () => {
    expect(scoreSentiment("not great")).toBeGreaterThan(scoreSentiment("terrible"));
    expect(scoreSentiment("not great")).toBeLessThan(0);
  });

  it("applies within the window and not beyond it", () => {
    expect(scoreSentiment("not amazing")).toBeLessThan(0);
    // Far enough away that the negation is about something else entirely.
    expect(scoreSentiment("not once did I stop to think it was amazing")).toBeGreaterThan(0);
  });

  it("handles contractions, which tokenize by stripping the apostrophe", () => {
    expect(scoreSentiment("this isn't good")).toBeLessThan(0);
    expect(scoreSentiment("I don't love it")).toBeLessThan(0);
  });
});

describe("scoreSentiment — intensity", () => {
  it("scales with an intensifier", () => {
    expect(Math.abs(scoreSentiment("really great"))).toBeGreaterThan(
      Math.abs(scoreSentiment("great"))
    );
    expect(scoreSentiment("extremely boring")).toBeLessThan(scoreSentiment("boring"));
  });

  it("dampens with a downtoner", () => {
    expect(scoreSentiment("kinda good")).toBeLessThan(scoreSentiment("good"));
  });

  it("amplifies shouting", () => {
    expect(scoreSentiment("THIS IS AMAZING")).toBeGreaterThan(scoreSentiment("this is amazing"));
  });

  it("adds magnitude for exclamation marks in the established direction", () => {
    expect(scoreSentiment("great!!!")).toBeGreaterThan(scoreSentiment("great"));
    expect(scoreSentiment("awful!!!")).toBeLessThan(scoreSentiment("awful"));
  });
});

describe("scoreSentiment — emoji", () => {
  it("scores emoji-only comments", () => {
    expect(scoreSentiment("🔥🔥🔥")).toBeGreaterThan(0);
    expect(scoreSentiment("🤬")).toBeLessThan(0);
  });

  it("counts emoji alongside words", () => {
    expect(scoreSentiment("good 🔥")).toBeGreaterThan(scoreSentiment("good"));
  });
});

describe("scoreSentiment — range", () => {
  it("never leaves [-1, 1], however extreme the input", () => {
    const extremes = [
      "masterpiece masterpiece masterpiece perfection flawless brilliant amazing!!!!",
      "AWFUL TERRIBLE GARBAGE WORST DISGUSTING ATROCIOUS ABYSMAL!!!!",
      "🔥".repeat(200),
      "🤬".repeat(200),
    ];
    for (const text of extremes) {
      const score = scoreSentiment(text);
      expect(score).toBeGreaterThanOrEqual(-1);
      expect(score).toBeLessThanOrEqual(1);
      expect(Number.isFinite(score)).toBe(true);
    }
  });
});

describe("labelOf — the deadband", () => {
  it("keeps weak signal in neutral", () => {
    expect(labelOf(0)).toBe("neutral");
    expect(labelOf(0.1)).toBe("neutral");
    expect(labelOf(-0.1)).toBe("neutral");
  });

  it("labels past the threshold", () => {
    expect(labelOf(0.5)).toBe("positive");
    expect(labelOf(-0.5)).toBe("negative");
  });
});

describe("tokenize", () => {
  it("lowercases, drops punctuation, and strips apostrophes", () => {
    expect(tokenize("Don't! Stop... Now?")).toEqual(["dont", "stop", "now"]);
  });

  it("returns an empty array for punctuation-only input", () => {
    expect(tokenize("!!! ???")).toEqual([]);
  });
});

describe("extractEmoji", () => {
  it("finds emoji and preserves repeats", () => {
    expect(extractEmoji("🔥 nice 🔥")).toHaveLength(2);
  });

  it("returns nothing for plain text", () => {
    expect(extractEmoji("just words here")).toEqual([]);
  });
});

describe("isLikelyEnglish — the gate that keeps unscorable sections out", () => {
  it("accepts ordinary English", () => {
    expect(isLikelyEnglish("this is the best video I have seen all year")).toBe(true);
    expect(isLikelyEnglish("I can't believe he did that")).toBe(true);
  });

  it("rejects other languages", () => {
    expect(isLikelyEnglish("這個影片太棒了我很喜歡")).toBe(false);
    expect(isLikelyEnglish("هذا الفيديو رائع جدا")).toBe(false);
    expect(isLikelyEnglish("этот ролик просто отличный")).toBe(false);
  });

  it("rejects emoji-only and empty comments", () => {
    expect(isLikelyEnglish("🔥🔥🔥")).toBe(false);
    expect(isLikelyEnglish("")).toBe(false);
  });
});

describe("extractEmoji — whole emoji, as a reader sees them", () => {
  // Built from code points so no invisible joiner can be lost in an edit.
  const facepalmMan = String.fromCodePoint(0x1f926, 0x200d, 0x2642, 0xfe0f);
  const thumbsMedium = String.fromCodePoint(0x1f44d, 0x1f3fd);
  const thumbs = String.fromCodePoint(0x1f44d);

  it("keeps a zero-width-joined emoji whole instead of leaking its parts", () => {
    // Regression, 2026-09-19: edition 1 printed a bare male sign in an emoji
    // row, split off a man-facepalming by a matcher that worked per code point.
    const found = extractEmoji(`bro ${facepalmMan} why`);
    expect(found).toHaveLength(1);
    expect(found).not.toContain(String.fromCodePoint(0x2642));
  });

  it("merges skin tones into the base emoji", () => {
    expect(extractEmoji(`${thumbsMedium} ${thumbs}`)).toEqual([thumbs, thumbs]);
  });

  it("does not count copyright or trademark signs as emoji", () => {
    expect(extractEmoji("Brand™ © 2026")).toEqual([]);
  });
});

describe("scoreSentiment — emoji written with a presentation selector", () => {
  it("counts a red heart, which the valence table had never matched", () => {
    // Regression, 2026-09-19: the table keys the heart WITH U+FE0F and
    // extraction strips it, so six entries including both hearts scored 0.
    expect(scoreSentiment(String.fromCodePoint(0x2764, 0xfe0f))).toBeGreaterThan(0);
    expect(scoreSentiment(String.fromCodePoint(0x2764))).toBeGreaterThan(0);
  });
});
