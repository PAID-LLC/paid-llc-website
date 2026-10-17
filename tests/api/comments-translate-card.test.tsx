/**
 * The Translate block is the same component on the edition card and the
 * video page (`expanded`). It has to be present for a "(Sub)" title, a
 * YouTube language code, and a non-English comment section, and absent for
 * an ordinary English card.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VideoCard } from "@/components/comments/VideoCard";
import type { FeaturedRow, VideoRow } from "@/lib/comments/types";

function video(over: Partial<VideoRow> = {}): VideoRow {
  return {
    video_id: "dgV7wo5hcqE",
    first_edition: "2026-10-16",
    rank: 1,
    status: "analyzed",
    skip_reason: null,
    title: "Mitti De Baway Ep 08 (Sub) 15 Oct 26 | Green TV",
    channel_id: "UCgreen",
    channel_title: "Green TV",
    thumbnail_url: null,
    duration_s: 2091,
    published_at: "2026-10-15T12:00:00Z",
    stats: { views: 7_000_000, views_per_hour: 311000 },
    summary: "A family argument in a courtyard, spoken in Punjabi.",
    analysis: { englishRatio: 0.72, analyzed: 1000, vibe: "Loud and affectionate." },
    gemini: {},
    ...over,
  };
}

function html(node: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(node);
}

describe("VideoCard Translate", () => {
  it("offers Translate on a subtitled card and on the expanded video page", () => {
    const page = "https://paiddev.com/comments/v/dgV7wo5hcqE";
    const translateHref =
      "https://translate.google.com/translate?sl=auto&amp;tl=en&amp;u=" +
      encodeURIComponent(page).replace(/&/g, "&amp;");
    for (const expanded of [false, true]) {
      const markup = html(createElement(VideoCard, { video: video(), featured: [], rank: 1, expanded }));
      expect(markup).toContain("Translate");
      expect(markup).toContain("Translate this page");
      expect(markup).toContain(translateHref);
      expect(markup).toContain("Watch on YouTube with auto-translated captions");
      expect(markup).toContain("https://www.youtube.com/watch?v=dgV7wo5hcqE");
      expect(markup).toContain("English summary");
      expect(markup).toContain("A family argument in a courtyard, spoken in Punjabi.");
    }
  });

  it("stays off an English card", () => {
    const markup = html(
      createElement(VideoCard, {
        video: video({
          video_id: "rz1B4B2yBZY",
          title: "Grand Theft Auto VI Launch Trailer",
          summary: "A city at night.",
          analysis: { englishRatio: 0.9, analyzed: 1000 },
        }),
        featured: [],
        rank: 0,
      })
    );
    expect(markup).not.toContain("Translate this page");
    expect(markup).not.toContain("English summary");
  });

  it("follows a stored YouTube language code even when the title is Latin", () => {
    const markup = html(
      createElement(VideoCard, {
        video: video({
          video_id: "abc123XYZ09",
          title: "295 (MUSIC VIDEO) SIDHU MOOSE WALA",
          stats: { default_audio_language: "pa", default_language: null },
          analysis: { englishRatio: 0.8, analyzed: 1000 },
          summary: "A music video.",
        }),
        featured: [],
        rank: 0,
        expanded: true,
      })
    );
    expect(markup).toContain("translate.google.com/translate?sl=auto");
    expect(markup).toContain(encodeURIComponent("https://paiddev.com/comments/v/abc123XYZ09").replace(/&/g, "&amp;"));
    expect(markup).toContain("https://www.youtube.com/watch?v=abc123XYZ09");
  });

  it("reads the featured comments when the title and the stored ratio look English", () => {
    const comments: FeaturedRow[] = [1, 2, 3].map((i) => ({
      comment_id: `c${i}`,
      video_id: "C9OmyNRyz4E",
      role: "top" as const,
      position: i,
      author_display: "A",
      author_channel_id: null,
      text: "mitti de baway wala scene ajj bohat emotional si te har koi ro raha bahut",
      like_count: 10,
      published_at: null,
      why: null,
    }));
    const markup = html(
      createElement(VideoCard, {
        video: video({
          video_id: "C9OmyNRyz4E",
          title: "295 (MUSIC VIDEO) SIDHU MOOSE WALA",
          analysis: { englishRatio: 0.7, analyzed: 1000 },
          summary: null,
        }),
        featured: comments,
        rank: 0,
      })
    );
    expect(markup).toContain("Translate this page");
    expect(markup).not.toContain("English summary");
  });
});
