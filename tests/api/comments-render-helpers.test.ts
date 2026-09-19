/**
 * Tests for formatting and SVG geometry (lib/comments/render-helpers.ts).
 *
 * Why this file exists: the charts on this page are hand-rolled SVG rather than
 * a charting dependency (the Worker bundle sits near its 10 MiB cap), so the arc
 * and path maths is ours to get right. ringArcs in particular has to consume the
 * circumference exactly, or the donut renders with a hairline gap that looks
 * like a rendering bug rather than a design.
 *
 * The date helpers are here because edition dates are date-only strings and the
 * obvious `new Date("2026-09-14")` parse would shift them a day backwards for
 * anyone west of UTC, silently relabelling the archive.
 */

import { describe, it, expect } from "vitest";
import {
  formatCount,
  pct,
  formatEditionDate,
  formatShortDate,
  formatDuration,
  relativeTime,
  ordinal,
  ringArcs,
  sparklinePath,
  truncate,
  escapeXml,
  isValidEditionDate,
  isValidVideoId,
  youtubeWatchUrl,
} from "@/lib/comments/render-helpers";

describe("formatCount", () => {
  it("keeps small numbers exact", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
  });

  it("abbreviates thousands and millions", () => {
    expect(formatCount(4812)).toBe("4.8k");
    expect(formatCount(12000)).toBe("12k");
    expect(formatCount(1_200_000)).toBe("1.2M");
  });

  it("drops a trailing .0", () => {
    expect(formatCount(5000)).toBe("5k");
  });

  it("returns 0 for nonsense rather than NaN on the page", () => {
    expect(formatCount(NaN)).toBe("0");
    expect(formatCount(-5)).toBe("0");
  });
});

describe("pct", () => {
  it("renders a share as a percentage", () => {
    expect(pct(0.62)).toBe("62%");
    expect(pct(0.625, 1)).toBe("62.5%");
  });

  it("survives NaN", () => {
    expect(pct(NaN)).toBe("0%");
  });
});

describe("date formatting — no timezone drift", () => {
  it("renders the date it was given, not the day before", () => {
    // The bug this prevents: new Date("2026-09-14") parses as UTC midnight, and
    // toLocaleDateString in a US timezone then renders September 13.
    expect(formatEditionDate("2026-09-14")).toBe("Monday, September 14, 2026");
    expect(formatShortDate("2026-09-14")).toBe("Sep 14");
  });

  it('passes malformed input through rather than rendering an Invalid Date', () => {
    expect(formatEditionDate("nonsense")).toBe("nonsense");
  });
});

describe("ordinal — caught by the render check printing \"3th hour\"", () => {
  it("uses st, nd, rd for 1, 2, 3", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
  });

  it("gives the teens th, which is the whole reason this function exists", () => {
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
  });

  it("handles every hour a velocity bucket can produce", () => {
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(23)).toBe("23rd");
    expect(ordinal(24)).toBe("24th");
  });

  it("survives nonsense", () => {
    expect(ordinal(NaN)).toBe("0th");
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(253)).toBe("4:13");
    expect(formatDuration(3723)).toBe("1:02:03");
  });

  it("renders nothing for a missing duration", () => {
    expect(formatDuration(null)).toBe("");
    expect(formatDuration(0)).toBe("");
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");

  it("describes recent and distant times", () => {
    expect(relativeTime("2026-09-14T11:58:00Z", now)).toBe("2 minutes ago");
    expect(relativeTime("2026-09-14T09:00:00Z", now)).toBe("3 hours ago");
    expect(relativeTime("2026-09-10T12:00:00Z", now)).toBe("4 days ago");
    expect(relativeTime("2025-09-14T12:00:00Z", now)).toBe("1 year ago");
  });

  it("returns an empty string for null or unparseable input", () => {
    expect(relativeTime(null, now)).toBe("");
    expect(relativeTime("nonsense", now)).toBe("");
  });
});

describe("ringArcs — the donut must not show a seam", () => {
  const C = 100;

  it("consumes the circumference exactly", () => {
    const arcs = ringArcs({ positive: 0.333, neutral: 0.333, negative: 0.334 }, C);
    expect(arcs.reduce((sum, a) => sum + a.dash, 0)).toBeCloseTo(C, 6);
  });

  it("offsets each arc by everything before it", () => {
    const arcs = ringArcs({ positive: 0.5, neutral: 0.3, negative: 0.2 }, C);
    expect(arcs[0].offset).toBe(-0);
    expect(arcs[1].offset).toBeCloseTo(-50);
    expect(arcs[2].offset).toBeCloseTo(-80);
  });

  it("normalizes shares that do not sum to 1", () => {
    const arcs = ringArcs({ positive: 2, neutral: 1, negative: 1 }, C);
    expect(arcs.reduce((sum, a) => sum + a.dash, 0)).toBeCloseTo(C, 6);
    expect(arcs[0].dash).toBeCloseTo(50);
  });

  it("renders a full neutral ring rather than nothing when there is no data", () => {
    const arcs = ringArcs({ positive: 0, neutral: 0, negative: 0 }, C);
    expect(arcs).toHaveLength(1);
    expect(arcs[0].dash).toBe(C);
  });

  it("drops zero-width arcs so they cannot render as specks", () => {
    const arcs = ringArcs({ positive: 1, neutral: 0, negative: 0 }, C);
    expect(arcs).toHaveLength(1);
  });
});

describe("sparklinePath", () => {
  it("produces a line and a closed area", () => {
    const { line, area } = sparklinePath([1, 5, 2, 8], 100, 20);
    expect(line.startsWith("M")).toBe(true);
    expect(area.endsWith("Z")).toBe(true);
  });

  it("locates the peak", () => {
    const { peakIndex } = sparklinePath([1, 5, 2, 8, 3], 100, 20);
    expect(peakIndex).toBe(3);
  });

  it("puts the peak at the top of the box", () => {
    const { peakY } = sparklinePath([0, 10], 100, 20);
    expect(peakY).toBe(0);
  });

  it("handles an all-zero series without dividing by zero", () => {
    const { line } = sparklinePath([0, 0, 0], 100, 20);
    expect(line).not.toContain("NaN");
  });

  it("returns empty output for an empty series", () => {
    expect(sparklinePath([], 100, 20).line).toBe("");
  });
});

describe("truncate", () => {
  it("leaves short text alone", () => {
    expect(truncate("short", 20)).toBe("short");
  });

  it("cuts on a word boundary", () => {
    expect(truncate("the quick brown fox jumps over", 20)).toBe("the quick brown fox…");
  });

  it("never halves an emoji into a lone surrogate", () => {
    // Regression, 2026-09-19: a UTF-16 slice through an emoji at the cut left a
    // lone high surrogate, which renders as a replacement box.
    const out = truncate("abcdefghi😂xyz", 10);
    expect(out).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(out).toBe("abcdefghi😂…");
  });
});

describe("escapeXml — the RSS and sitemap routes depend on this", () => {
  it("escapes all five entities", () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;"
    );
  });
});

describe("validation — what the dynamic routes accept", () => {
  it("accepts real calendar dates and rejects impossible ones", () => {
    expect(isValidEditionDate("2026-09-14")).toBe(true);
    expect(isValidEditionDate("2026-02-31")).toBe(false);
    expect(isValidEditionDate("2026-13-01")).toBe(false);
    expect(isValidEditionDate("14-09-2026")).toBe(false);
    expect(isValidEditionDate("../../etc/passwd")).toBe(false);
  });

  it("accepts only well-formed video ids", () => {
    expect(isValidVideoId("dQw4w9WgXcQ")).toBe(true);
    expect(isValidVideoId("too-short")).toBe(false);
    expect(isValidVideoId("../../../etc")).toBe(false);
  });
});

describe("youtubeWatchUrl — required attribution links", () => {
  it("links a video, and deep-links a comment when given one", () => {
    expect(youtubeWatchUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(youtubeWatchUrl("dQw4w9WgXcQ", "Ugz123")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&lc=Ugz123"
    );
  });
});
