/**
 * Tests for the feed renderings (lib/comments/feed-html.ts).
 *
 * Why this file exists: what this module returns is mailed. A campaign built on
 * /comments/rss.xml sends the item body to every subscriber, and a sent email
 * cannot be corrected, redeployed, or taken down. Three classes of defect are
 * therefore worth locking rather than noticing later:
 *
 *   1. Compliance that has to travel with the item, because the email is read
 *      far from the page where the disclosure and the YouTube links live.
 *   2. Escaping. Comment text is arbitrary public input, and a comment
 *      containing "<3" or "]]>" is ordinary, not adversarial.
 *   3. Email-client survival: a fragment with inline styles, never a document
 *      and never a <style> block, both of which Gmail and Outlook drop.
 */

import { describe, it, expect } from "vitest";
import { editionHtml, editionText } from "@/lib/comments/feed-html";
import type { EditionBundle, FeaturedRow, VideoRow } from "@/lib/comments/types";

function video(over: Partial<VideoRow> = {}): VideoRow {
  return {
    video_id: "abcdefghijk",
    first_edition: "2026-09-19",
    rank: 0,
    status: "analyzed",
    skip_reason: null,
    title: "A Rising Video",
    channel_id: "UCchannel",
    channel_title: "Some Channel",
    thumbnail_url: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
    duration_s: 600,
    published_at: "2026-09-18T12:00:00Z",
    stats: { views: 1_000_000, likes: 10_000, comments: 2_000, views_per_hour: 41_666 },
    summary: "Someone builds a shed and it goes badly.",
    analysis: { vibe: "Delighted, and a little concerned for the shed." },
    gemini: {},
    ...over,
  };
}

function featured(over: Partial<FeaturedRow> = {}): FeaturedRow {
  return {
    comment_id: "c-top",
    video_id: "abcdefghijk",
    role: "top",
    position: 0,
    author_display: "Alex",
    author_channel_id: "UCauthor",
    text: "The shed had it coming",
    like_count: 12_000,
    published_at: "2026-09-18T14:00:00Z",
    why: null,
    ...over,
  };
}

function bundle(over: Partial<EditionBundle> = {}): EditionBundle {
  return {
    edition: {
      edition_date: "2026-09-19",
      edition_no: 1,
      region: "US",
      status: "published",
      headline: "Five videos, 3.9k comments, and one shed.",
      teaser: "A teaser.",
      video_ids: ["abcdefghijk"],
      hero_comment_id: "c-hero",
      stats: {
        commentsAnalyzed: 3893,
        videosAnalyzed: 1,
        positiveShare: 0.329,
        negativeShare: 0.055,
        automationShare: 0.0033,
      },
      published_at: "2026-09-19T12:00:00Z",
    },
    videos: [video()],
    featured: [
      featured(),
      featured({
        comment_id: "c-hero",
        role: "funniest",
        text: "nobody:\nthe shed: goodbye",
        like_count: 1,
        author_display: "Sam",
        why: "It gives the shed the last word.",
      }),
    ],
    ...over,
  };
}

describe("editionHtml — what gets mailed", () => {
  it("carries the hero comment, the video, and the link back to the edition", () => {
    const html = editionHtml(bundle());
    expect(html).toContain("the shed: goodbye");
    expect(html).toContain("It gives the shed the last word.");
    expect(html).toContain("A Rising Video");
    expect(html).toContain("The shed had it coming");
    expect(html).toContain("https://paiddev.com/comments/2026-09-19");
    expect(html).toContain("Edition 1");
  });

  it("keeps YouTube's attribution with the data: channel name and a link per video", () => {
    const html = editionHtml(bundle());
    expect(html).toContain("Some Channel");
    expect(html).toContain("https://www.youtube.com/watch?v=abcdefghijk");
  });

  it("states that the percentages are ours, since the reader is far from the page that says so", () => {
    const html = editionHtml(bundle());
    expect(html).toContain("PAID LLC");
    expect(html).toMatch(/not YouTube metrics/i);
    expect(html).toMatch(/Not affiliated with or endorsed by YouTube/i);
  });

  it("escapes comment text rather than rendering it as markup", () => {
    const html = editionHtml(
      bundle({
        featured: [
          featured({ text: "<b>i love this</b> <3 && \"quoted\"" }),
          featured({ comment_id: "c-hero", role: "funniest", text: "plain", like_count: 0 }),
        ],
      })
    );
    expect(html).not.toContain("<b>i love this</b>");
    expect(html).toContain("&lt;b&gt;i love this&lt;/b&gt;");
    // "]]>" from a comment would otherwise close the route's CDATA section early
    // and take the whole feed down with it.
    expect(html).not.toContain("]]>");
  });

  it("is a fragment with inline styles, not a document (Gmail and Outlook drop the rest)", () => {
    const html = editionHtml(bundle());
    expect(html).not.toMatch(/<html|<body|<style|<script/i);
    expect(html).toContain("style=");
  });

  it("leaves skipped videos out", () => {
    const html = editionHtml(
      bundle({
        videos: [video(), video({ video_id: "zzzzzzzzzzz", title: "Skipped One", status: "skipped" })],
      })
    );
    expect(html).toContain("A Rising Video");
    expect(html).not.toContain("Skipped One");
  });

  it("does not repeat the hero comment inside its own video card", () => {
    const html = editionHtml(bundle());
    expect(html.match(/the shed: goodbye/g)).toHaveLength(1);
  });

  it("survives an edition whose hero comment was removed upstream", () => {
    const html = editionHtml(
      bundle({ featured: [featured(), featured({ comment_id: "c-hero", role: "funniest", text: null })] })
    );
    expect(html).toContain("A Rising Video");
    expect(html).not.toContain("Underrated comment of the day");
    expect(html).not.toContain("null");
  });

  it("uses no em dashes, per house style", () => {
    expect(editionHtml(bundle())).not.toMatch(/[—–]/);
    expect(editionText(bundle())).not.toMatch(/[—–]/);
  });
});

describe("editionText — the plain fallback", () => {
  it("says the same things without markup", () => {
    const text = editionText(bundle());
    expect(text).toContain("the shed: goodbye");
    expect(text).toContain("A Rising Video");
    expect(text).toContain("https://paiddev.com/comments/2026-09-19");
    expect(text).toMatch(/not YouTube metrics/i);
    expect(text).not.toContain("<");
  });
});
