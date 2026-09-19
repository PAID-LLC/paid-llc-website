/**
 * Tests for the two model calls (lib/comments/gemini.ts).
 *
 * Why this file exists, in order of how much each would cost if it broke:
 *
 * 1. THE BUDGET GATES. The video call is the largest request this site makes,
 *    roughly 50x a lounge chat reply. It must take the global "gemini" gate AND
 *    its own counter, in that order, before spending anything. A regression here
 *    is a bill, not a bug report.
 * 2. THE CLIPPING PARAMETERS. endOffset and fps are the difference between 35k
 *    and 180k input tokens per video. They are easy to drop in a refactor and
 *    nothing at runtime would complain.
 * 3. INDEX VALIDATION. The editorial response names a comment by index. An
 *    out-of-range index that slipped through would publish the WRONG person's
 *    comment as the funniest of the day, attributed to them by name.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  geminiVideoSummary,
  geminiEditorial,
  validateEditorial,
  fallbackEditorial,
  buildDigest,
  cleanProse,
  EDITORIAL_SCHEMA,
  geminiHero,
  validateHero,
} from "@/lib/comments/gemini";
import type { ScoredComment, VideoAnalysis } from "@/lib/comments/types";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_KEY = "test-service-key";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

interface Captured {
  meterCalls: string[];
  geminiBodies: Record<string, unknown>[];
}

/** Records the meter RPC order and every Gemini body. */
function stub(reply: string | null, opts: { meterAllows?: boolean } = {}): Captured {
  const captured: Captured = { meterCalls: [], geminiBodies: [] };
  const allows = opts.meterAllows ?? true;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("meter_daily")) {
        const body = JSON.parse(String(init?.body)) as { p_counter: string };
        captured.meterCalls.push(body.p_counter);
        return new Response(JSON.stringify(allows), { status: 200 });
      }
      if (url.includes("generativelanguage")) {
        captured.geminiBodies.push(JSON.parse(String(init?.body)));
        if (reply === null) return new Response("upstream error", { status: 500 });
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: reply }] } }],
            usageMetadata: { promptTokenCount: 35123, candidatesTokenCount: 180 },
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    })
  );
  return captured;
}

function analysis(over: Partial<VideoAnalysis> = {}): VideoAnalysis {
  return {
    analyzed: 1000,
    positiveShare: 0.6,
    neutralShare: 0.3,
    negativeShare: 0.1,
    meanSentiment: 0.3,
    histogram: new Array(10).fill(100),
    themes: ["camera work", "the ending", "sound mix"],
    emoji: [{ char: "🔥", count: 40 }],
    velocity: new Array(24).fill(10),
    busiestHour: 2,
    automation: { shareLikely: 0.08, shareSuspicious: 0.04, signals: {}, confidence: "high", uniqueAuthors: 900, channelsResolved: 880 },
    englishRatio: 0.9,
    medianLikes: 3,
    maxLikes: 5000,
    degraded: [],
    summarySource: "video",
    vibe: "",
    ytUnits: 27,
    ...over,
  };
}

function candidate(i: number): ScoredComment {
  return {
    id: `cand${i}`,
    text: `nobody: the cameraman at ${i}:02: absolutely unbothered`,
    authorDisplay: `Person ${i}`,
    authorChannelId: `UC${i}`,
    authorAvatarUrl: "",
    likeCount: 1,
    replyCount: 0,
    publishedAt: "2026-09-12T00:00:00Z",
    sentiment: 0.2,
    automation: 0,
    signals: [],
    humor: 5,
  };
}

describe("geminiVideoSummary — the request that costs money", () => {
  it("takes the global budget gate BEFORE its own counter", async () => {
    const c = stub("A short description of the video.");
    await geminiVideoSummary("dQw4w9WgXcQ", "A Title");
    expect(c.meterCalls).toEqual(["gemini", "comments_video"]);
  });

  it("spends nothing when the global gate refuses", async () => {
    const c = stub("unused", { meterAllows: false });
    const result = await geminiVideoSummary("dQw4w9WgXcQ", "A Title");
    expect(result).toBeNull();
    expect(c.geminiBodies).toHaveLength(0);
  });

  it("spends nothing when the key is unset", async () => {
    delete process.env.GEMINI_API_KEY;
    const c = stub("unused");
    expect(await geminiVideoSummary("dQw4w9WgXcQ", "A Title")).toBeNull();
    expect(c.meterCalls).toHaveLength(0);
  });

  it("passes the YouTube URL as a file_data part rather than downloading it", async () => {
    const c = stub("A description.");
    await geminiVideoSummary("dQw4w9WgXcQ", "A Title");
    const part = (c.geminiBodies[0] as never as { contents: { parts: { file_data?: { file_uri: string } }[] }[] })
      .contents[0].parts[0];
    expect(part.file_data?.file_uri).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("clips and subsamples, which is the whole cost saving", async () => {
    const c = stub("A description.");
    await geminiVideoSummary("dQw4w9WgXcQ", "A Title");
    const part = (c.geminiBodies[0] as never as { contents: { parts: { videoMetadata?: { endOffset: string; fps: number } }[] }[] })
      .contents[0].parts[0];
    expect(part.videoMetadata?.endOffset).toBe("720s");
    expect(part.videoMetadata?.fps).toBe(0.25);
  });

  it("reports real token usage so the day can be priced", async () => {
    stub("A description.");
    const result = await geminiVideoSummary("dQw4w9WgXcQ", "A Title");
    expect(result?.usage.in).toBe(35123);
    expect(result?.usage.out).toBe(180);
  });

  it("returns null instead of throwing when the API fails", async () => {
    stub(null);
    expect(await geminiVideoSummary("dQw4w9WgXcQ", "A Title")).toBeNull();
  });
});

describe("geminiEditorial — structured output", () => {
  const good = JSON.stringify({
    vibe: "Warm, and mostly arguing about the drummer.",
    themes: ["the drummer", "camera work", "the ending"],
    funniest: { index: 2, why: "The timing does all the work." },
    runners_up: [0, 1],
  });

  it("constrains the response shape rather than parsing prose", async () => {
    const c = stub(good);
    await geminiEditorial("digest", 5);
    const cfg = (c.geminiBodies[0] as { generationConfig: Record<string, unknown> }).generationConfig;
    expect(cfg.responseMimeType).toBe("application/json");
    expect(cfg.responseSchema).toEqual(EDITORIAL_SCHEMA);
  });

  it("spends nothing when there are no candidates to judge", async () => {
    const c = stub(good);
    expect(await geminiEditorial("digest", 0)).toBeNull();
    expect(c.meterCalls).toHaveLength(0);
  });

  it("returns the parsed verdict with usage", async () => {
    stub(good);
    const result = await geminiEditorial("digest", 5);
    expect(result?.editorial.funniest.index).toBe(2);
    expect(result?.usage.in).toBe(35123);
  });
});

describe("validateEditorial — the guard against quoting the wrong person", () => {
  const base = {
    vibe: "A vibe.",
    themes: ["a", "b", "c"],
    funniest: { index: 1, why: "Because." },
    runners_up: [0, 2],
  };

  it("accepts a well-formed response", () => {
    expect(validateEditorial(JSON.stringify(base), 5)?.funniest.index).toBe(1);
  });

  it("REJECTS an index past the end of the candidate list", () => {
    // Accepting this would publish an undefined comment, or worse, silently
    // shift onto a different person's words.
    expect(validateEditorial(JSON.stringify({ ...base, funniest: { index: 99, why: "x" } }), 5)).toBeNull();
  });

  it("rejects a negative index", () => {
    expect(validateEditorial(JSON.stringify({ ...base, funniest: { index: -1, why: "x" } }), 5)).toBeNull();
  });

  it("rejects a non-integer index", () => {
    expect(validateEditorial(JSON.stringify({ ...base, funniest: { index: 1.5, why: "x" } }), 5)).toBeNull();
  });

  it("drops out-of-range runners-up instead of failing the whole response", () => {
    const result = validateEditorial(JSON.stringify({ ...base, runners_up: [0, 99] }), 5);
    expect(result?.runners_up).toEqual([0]);
  });

  it("never lets a runner-up duplicate the winner", () => {
    const result = validateEditorial(JSON.stringify({ ...base, runners_up: [1, 2] }), 5);
    expect(result?.runners_up).not.toContain(1);
  });

  it("rejects unparseable output", () => {
    expect(validateEditorial("not json at all", 5)).toBeNull();
  });

  it("tolerates code fences, which the endpoint should not send but has before", () => {
    expect(validateEditorial("```json\n" + JSON.stringify(base) + "\n```", 5)?.funniest.index).toBe(1);
  });

  it("strips em dashes from model prose", () => {
    const result = validateEditorial(
      JSON.stringify({ ...base, vibe: "Warm — and loud." }),
      5
    );
    expect(result?.vibe).not.toMatch(/[—–]/);
  });
});

describe("fallbackEditorial — what publishes when the model is unavailable", () => {
  it("picks the top code-ranked candidate rather than nothing", () => {
    const f = fallbackEditorial(analysis(), [candidate(0), candidate(1), candidate(2)]);
    expect(f.funniest.index).toBe(0);
    expect(f.runners_up).toEqual([1, 2]);
  });

  it("describes the mood from the computed shares", () => {
    expect(fallbackEditorial(analysis({ positiveShare: 0.8 }), [candidate(0)]).vibe).toMatch(/warm/i);
    expect(fallbackEditorial(analysis({ negativeShare: 0.5 }), [candidate(0)]).vibe).toMatch(/not having it/i);
  });

  it("handles an empty shortlist without producing a bad index", () => {
    const f = fallbackEditorial(analysis(), []);
    expect(f.funniest.index).toBe(-1);
    expect(f.runners_up).toEqual([]);
  });
});

describe("buildDigest — what the model is allowed to see", () => {
  const digest = buildDigest("A Title", "It is a video.", analysis(), [candidate(9)], [candidate(0), candidate(1)]);

  it("quarantines every comment, because comment sections are hostile input", () => {
    // Somebody will eventually post "ignore previous instructions" under a
    // trending video. When they do, it has to arrive marked as data.
    expect(digest).toContain("untrusted content");
  });

  it("separates context from eligible picks in the text itself", () => {
    expect(digest).toContain("NOT eligible");
    expect(digest).toContain("CANDIDATES");
  });

  it("carries the computed statistics so the model never recalculates them", () => {
    expect(digest).toContain("60% positive");
    expect(digest).toContain("Comments analysed: 1000");
  });

  it("stays small, which is the point of computing everything first", () => {
    const big = buildDigest(
      "A Title",
      "It is a video.",
      analysis(),
      Array.from({ length: 30 }, (_, i) => candidate(i)),
      Array.from({ length: 25 }, (_, i) => candidate(i + 100))
    );
    // ~4 chars per token: a 20k-char digest would be a 5k-token call, and this
    // has to stay well under that to keep a video's total near 40k.
    expect(big.length).toBeLessThan(20000);
  });
});

describe("cleanProse", () => {
  it("replaces em dashes, strips markdown bold, and collapses whitespace", () => {
    expect(cleanProse("**Bold** — and   spaced")).toBe("Bold, and spaced");
  });

  it("strips wrapping quotes the model likes to add", () => {
    expect(cleanProse('"A quoted line"')).toBe("A quoted line");
  });
});

describe("the edition hero", () => {
  it("accepts only an in-range integer index", () => {
    expect(validateHero('{"index":2}', 5)).toBe(2);
    expect(validateHero('{"index":5}', 5)).toBeNull();
    expect(validateHero('{"index":-1}', 5)).toBeNull();
    expect(validateHero('{"index":1.5}', 5)).toBeNull();
    expect(validateHero("not json", 5)).toBeNull();
  });

  it("spends no call when there is nothing to choose between", async () => {
    const c = stub('{"index":0}');
    expect(await geminiHero([])).toBeNull();
    expect(await geminiHero([{ text: "only one", video: "A Video" }])).toBe(0);
    expect(c.meterCalls).toHaveLength(0);
    expect(c.geminiBodies).toHaveLength(0);
  });

  it("asks for a constrained index and returns it", async () => {
    const c = stub('{"index":1}');
    const picked = await geminiHero([
      { text: "first", video: "Video A" },
      { text: "second", video: "Video B" },
    ]);
    expect(picked).toBe(1);
    expect(c.meterCalls).toEqual(["gemini", "comments_text"]);
    const cfg = (c.geminiBodies[0] as { generationConfig: Record<string, unknown> }).generationConfig;
    expect(cfg.responseMimeType).toBe("application/json");
  });

  it("falls back (null) when the model names a finalist that does not exist", async () => {
    stub('{"index":7}');
    expect(await geminiHero([{ text: "a", video: "A" }, { text: "b", video: "B" }])).toBeNull();
  });
});
