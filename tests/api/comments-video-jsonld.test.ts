/**
 * Tests for VideoObject JSON-LD (lib/comments/video-jsonld.ts).
 *
 * Why this file exists: Search Console drops the Video rich result when
 * uploadDate is missing, and warns when description or embedUrl/contentUrl is
 * missing. Both the comments front page and the video permalink build that
 * object from a stored row. A row without a real date, description, or id has
 * to be left out entirely — a partial object is what the report flagged.
 */

import { describe, it, expect } from "vitest";
import type { EditionBundle, VideoRow } from "@/lib/comments/types";
import {
  collectVideoObjects,
  editionArticleJsonLd,
  serializeJsonLd,
  uploadDateWithTimezone,
  videoObjectIssues,
  videoObjectLd,
  videoPageArticleJsonLd,
  youtubeEmbedUrl,
} from "@/lib/comments/video-jsonld";

function video(over: Partial<VideoRow> = {}): VideoRow {
  return {
    video_id: "rz1B4B2yBZY",
    first_edition: "2026-10-16",
    rank: 0,
    status: "analyzed",
    skip_reason: null,
    title: "Grand Theft Auto VI Launch Trailer",
    channel_id: "UCchannel",
    channel_title: "Rockstar Games",
    thumbnail_url: "https://i.ytimg.com/vi/rz1B4B2yBZY/hqdefault.jpg",
    duration_s: 180,
    published_at: "2026-10-15T13:00:26+00:00",
    stats: { views: 1_000_000 },
    summary: "A launch trailer for Grand Theft Auto VI.",
    analysis: { vibe: "People are marveling at the final stretch." },
    gemini: {},
    ...over,
  };
}

function bundle(videos: VideoRow[]): EditionBundle {
  return {
    edition: {
      edition_date: "2026-10-16",
      edition_no: 28,
      region: "US",
      status: "published",
      headline: "Five videos.",
      teaser: "A teaser.",
      video_ids: videos.map((v) => v.video_id),
      hero_comment_id: null,
      stats: {},
      published_at: "2026-10-16T12:05:00Z",
    },
    videos,
    featured: [],
  };
}

describe("uploadDateWithTimezone", () => {
  it("accepts Z and numeric offsets and emits a canonical timestamp", () => {
    expect(uploadDateWithTimezone("2026-10-15T13:00:26Z")).toBe("2026-10-15T13:00:26.000Z");
    expect(uploadDateWithTimezone("2026-10-15T13:00:26+00:00")).toBe(
      "2026-10-15T13:00:26.000Z"
    );
    expect(uploadDateWithTimezone("2026-10-15T08:00:26-05:00")).toBe(
      "2026-10-15T13:00:26.000Z"
    );
  });

  it("rejects values that do not already carry a timezone", () => {
    expect(uploadDateWithTimezone("2026-10-15")).toBeNull();
    expect(uploadDateWithTimezone("2026-10-15T13:00:26")).toBeNull();
    expect(uploadDateWithTimezone("")).toBeNull();
    expect(uploadDateWithTimezone(null)).toBeNull();
  });
});

describe("videoObjectLd", () => {
  it("fills every field Search Console asked for from the stored row", () => {
    const object = videoObjectLd(video());
    expect(object).toEqual({
      "@type": "VideoObject",
      name: "Grand Theft Auto VI Launch Trailer",
      description: "A launch trailer for Grand Theft Auto VI.",
      thumbnailUrl: "https://i.ytimg.com/vi/rz1B4B2yBZY/hqdefault.jpg",
      uploadDate: "2026-10-15T13:00:26.000Z",
      embedUrl: "https://www.youtube.com/embed/rz1B4B2yBZY",
      url: "https://www.youtube.com/watch?v=rz1B4B2yBZY",
    });
    expect(videoObjectIssues(object)).toEqual([]);
  });

  it("uses the mood line when the video summary is missing", () => {
    const object = videoObjectLd(video({ summary: null }));
    expect(object?.description).toBe("People are marveling at the final stretch.");
  });

  it("derives the thumbnail and embed URL from the video id", () => {
    const object = videoObjectLd(video({ thumbnail_url: null }));
    expect(object?.thumbnailUrl).toBe("https://i.ytimg.com/vi/rz1B4B2yBZY/hqdefault.jpg");
    expect(object?.embedUrl).toBe(youtubeEmbedUrl("rz1B4B2yBZY"));
  });

  it("omits the object when the date, description, or id is not reliable", () => {
    expect(videoObjectLd(video({ published_at: null }))).toBeNull();
    expect(videoObjectLd(video({ published_at: "2026-10-15" }))).toBeNull();
    expect(videoObjectLd(video({ summary: "  ", analysis: {} }))).toBeNull();
    expect(videoObjectLd(video({ title: "  " }))).toBeNull();
    expect(videoObjectLd(video({ video_id: "not-an-id" }))).toBeNull();
    expect(videoObjectLd(video({ status: "skipped" }))).toBeNull();
  });

  it("omits a video the refresh has marked removed upstream", () => {
    expect(videoObjectLd(video({ stats: { removed: true } }))).toBeNull();
  });
});

describe("page documents", () => {
  it("puts a valid VideoObject on each analyzed video in an edition", () => {
    const dropped = video({
      video_id: "BFc2W5OF3BM",
      title: "Gone",
      stats: { removed: true },
      summary: "This one was deleted on YouTube.",
    });
    const doc = editionArticleJsonLd(bundle([video(), dropped, video({ status: "skipped" })]));
    const videos = collectVideoObjects(doc);
    expect(videos).toHaveLength(1);
    expect(videoObjectIssues(videos[0])).toEqual([]);
    expect(serializeJsonLd(doc)).toContain("https://www.youtube.com/embed/rz1B4B2yBZY");
    expect(serializeJsonLd(doc)).not.toContain("BFc2W5OF3BM");
  });

  it("omits about entirely when no video can be described", () => {
    const doc = editionArticleJsonLd(bundle([video({ published_at: null })]));
    expect(doc.about).toBeUndefined();
    expect(collectVideoObjects(doc)).toEqual([]);
  });

  it("builds the permalink document from the same object", () => {
    const doc = videoPageArticleJsonLd(video());
    const [only] = collectVideoObjects(doc);
    expect(videoObjectIssues(only)).toEqual([]);
    expect((only as { description: string }).description).toBe(
      "A launch trailer for Grand Theft Auto VI."
    );
  });

  it("drops about on a permalink whose video cannot fill the rich result", () => {
    const doc = videoPageArticleJsonLd(video({ summary: null, analysis: { vibe: "" } }));
    expect(doc.about).toBeUndefined();
  });

  it("escapes < so a title cannot close the script tag", () => {
    const html = serializeJsonLd(videoObjectLd(video({ title: "a </script><script> alert" })));
    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c");
    const parsed = JSON.parse(html);
    expect(videoObjectIssues(parsed)).toEqual([]);
    expect(parsed.name).toBe("a </script><script> alert");
  });

  it("round-trips through the script tag the pages emit", () => {
    const markup = `<script type="application/ld+json">${serializeJsonLd(
      editionArticleJsonLd(bundle([video(), video({ video_id: "dgV7wo5hcqE", title: "Second" })]))
    )}</script>`;
    document.body.innerHTML = markup;
    const raw = document.querySelector('script[type="application/ld+json"]')?.textContent;
    expect(raw).toBeTruthy();
    const videos = collectVideoObjects(JSON.parse(raw!));
    expect(videos).toHaveLength(2);
    for (const object of videos) expect(videoObjectIssues(object)).toEqual([]);
  });
});
