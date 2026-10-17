// ── VideoObject JSON-LD ──────────────────────────────────────────────────────
// One builder for every page that tells Google about a YouTube video: the
// comments front page, each archived edition, and the per-video permalink.
//
// Search Console rejects a Video rich result when uploadDate is missing, and
// warns when description or embedUrl/contentUrl is missing. Those three were
// being left off (the permalink had uploadDate only). The fields have to come
// from data we already stored. A VideoObject that cannot be filled in is
// omitted, so a thin row never becomes an invalid rich result.
//
// What is real, and what is not invented:
//   name         video.title
//   description  video.summary, else the stored mood line (analysis.vibe)
//   thumbnailUrl the stored thumbnail, else i.ytimg.com hqdefault for the id
//   uploadDate   video.published_at, and only when it already carries a timezone
//   embedUrl     https://www.youtube.com/embed/<id>
//   url          the YouTube watch page (schema.org's url, not contentUrl —
//                we do not have a stable media-file URL to put in contentUrl)
//
// A video the 30-day refresh has marked stats.removed is omitted. YouTube has
// already told us it is gone, and a rich result should not point at it.

import type { EditionBundle, VideoRow } from "./types";
import { isValidVideoId, youtubeWatchUrl } from "./render-helpers";

/** YouTube's publishedAt, or the same instant as Postgres timestamptz text. */
const ISO_WITH_TZ =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

export interface VideoObjectLd {
  "@type": "VideoObject";
  name: string;
  description: string;
  thumbnailUrl: string;
  /** ISO 8601 with an explicit timezone (canonical `Z` form). */
  uploadDate: string;
  embedUrl: string;
  url: string;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Canonical ISO 8601 with a timezone, or null when the stored value does not
 * already name one. Date-only strings and zone-less timestamps are rejected
 * rather than assumed to be UTC.
 */
export function uploadDateWithTimezone(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!ISO_WITH_TZ.test(trimmed)) return null;
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function descriptionOf(video: VideoRow): string {
  const summary = video.summary?.trim();
  if (summary) return summary;
  return video.analysis.vibe?.trim() ?? "";
}

function thumbnailOf(video: VideoRow): string {
  const stored = video.thumbnail_url?.trim();
  if (stored && /^https:\/\//.test(stored)) return stored;
  return youtubeThumbnailUrl(video.video_id);
}

/** A rich-result VideoObject, or null when a required field is not on the row. */
export function videoObjectLd(video: VideoRow): VideoObjectLd | null {
  if (video.status !== "analyzed") return null;
  if (video.stats.removed) return null;
  if (!isValidVideoId(video.video_id)) return null;

  const name = video.title?.trim();
  const description = descriptionOf(video);
  const uploadDate = uploadDateWithTimezone(video.published_at);
  if (!name || !description || !uploadDate) return null;

  return {
    "@type": "VideoObject",
    name,
    description,
    thumbnailUrl: thumbnailOf(video),
    uploadDate,
    embedUrl: youtubeEmbedUrl(video.video_id),
    url: youtubeWatchUrl(video.video_id),
  };
}

export function editionVideoObjects(videos: VideoRow[]): VideoObjectLd[] {
  return videos.flatMap((video) => {
    const object = videoObjectLd(video);
    return object ? [object] : [];
  });
}

/** Article JSON-LD shared by /comments and /comments/[date]. */
export function editionArticleJsonLd(bundle: EditionBundle): Record<string, unknown> {
  const about = editionVideoObjects(bundle.videos);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: bundle.edition.headline,
    datePublished: bundle.edition.published_at,
    url: `https://paiddev.com/comments/${bundle.edition.edition_date}`,
    description: bundle.edition.teaser,
    author: { "@type": "Organization", name: "PAID LLC", url: "https://paiddev.com" },
    publisher: { "@id": "https://paiddev.com/#organization" },
    isPartOf: {
      "@type": "Periodical",
      name: "The Comment Section",
      url: "https://paiddev.com/comments",
    },
    ...(about.length > 0 ? { about } : {}),
  };
}

/** Article JSON-LD for /comments/v/[videoId]. `about` is omitted when invalid. */
export function videoPageArticleJsonLd(video: VideoRow): Record<string, unknown> {
  const about = videoObjectLd(video);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `What ${video.channel_title}'s comment section said`,
    url: `https://paiddev.com/comments/v/${video.video_id}`,
    description: video.analysis.vibe,
    author: { "@type": "Organization", name: "PAID LLC", url: "https://paiddev.com" },
    publisher: { "@id": "https://paiddev.com/#organization" },
    ...(about ? { about } : {}),
  };
}

/** JSON for a script tag. `<` is escaped so a title cannot close the script. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export interface VideoObjectIssue {
  field: string;
  message: string;
}

/**
 * The Video rich-result checks Search Console reported, applied to one node.
 * Empty means the object carries name, description, thumbnailUrl, an
 * uploadDate with a timezone, and embedUrl or contentUrl.
 */
export function videoObjectIssues(node: unknown): VideoObjectIssue[] {
  const issues: VideoObjectIssue[] = [];
  if (!node || typeof node !== "object") {
    return [{ field: "@type", message: "VideoObject is missing" }];
  }
  const record = node as Record<string, unknown>;
  if (record["@type"] !== "VideoObject") {
    issues.push({ field: "@type", message: "expected VideoObject" });
  }

  const text = (field: string) => {
    const value = record[field];
    if (typeof value !== "string" || value.trim() === "") {
      issues.push({ field, message: `missing field "${field}"` });
    }
  };
  text("name");
  text("description");

  const thumb = record.thumbnailUrl;
  const thumbs = Array.isArray(thumb) ? thumb : [thumb];
  if (!thumbs.some((url) => typeof url === "string" && /^https:\/\//.test(url))) {
    issues.push({ field: "thumbnailUrl", message: 'missing field "thumbnailUrl"' });
  }

  const uploaded = record.uploadDate;
  if (typeof uploaded !== "string" || !uploadDateWithTimezone(uploaded)) {
    issues.push({ field: "uploadDate", message: 'missing field "uploadDate"' });
  }

  const embed = record.embedUrl;
  const content = record.contentUrl;
  const playable = (value: unknown) => typeof value === "string" && /^https:\/\//.test(value);
  if (!playable(embed) && !playable(content)) {
    issues.push({
      field: "embedUrl",
      message: 'either "contentUrl" or "embedUrl" should be specified',
    });
  }

  return issues;
}

/** Every VideoObject nested in a document, including an `about` array. */
export function collectVideoObjects(node: unknown): unknown[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(collectVideoObjects);
  const record = node as Record<string, unknown>;
  const own = record["@type"] === "VideoObject" ? [node] : [];
  return [
    ...own,
    ...Object.entries(record)
      .filter(([key]) => key !== "@type")
      .flatMap(([, value]) => collectVideoObjects(value)),
  ];
}
