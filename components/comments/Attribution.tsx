// ── Attribution and disclosure ───────────────────────────────────────────────
// The two components that make publishing this data permissible. Neither is
// decoration and neither is optional.
//
// YouTubeMark satisfies the requirement that displayed API data links back to
// its source. Disclosure satisfies III.E.4.h, which says derived metrics must
// carry a clear, prominent statement that they are ours rather than YouTube's.
//
// ON THE LOGO. YouTube's branding guidelines require their official, unmodified
// icon asset. We do not have it in the repo, and drawing an approximation of
// somebody's trademark is worse than not using it, so this renders a clear text
// link today. Drop the official SVG at public/brand/youtube-icon.svg (from
// youtube.com/howyoutubeworks/resources/brand-resources) and set WITH_ICON to
// true; nothing else changes.

import Link from "next/link";
import { youtubeWatchUrl, youtubeChannelUrl } from "@/lib/comments/render-helpers";

/** Flip to true once public/brand/youtube-icon.svg holds the official asset. */
const WITH_ICON = false;

export function YouTubeMark({
  videoId,
  commentId,
  channelId,
  label,
  className = "",
}: {
  videoId?: string;
  commentId?: string | null;
  channelId?: string;
  label?: string;
  className?: string;
}) {
  const href = videoId
    ? youtubeWatchUrl(videoId, commentId)
    : channelId
      ? youtubeChannelUrl(channelId)
      : "https://www.youtube.com";

  const text = label ?? (commentId ? "See it on YouTube" : "Watch on YouTube");

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={text}
      className={`inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-500 transition-colors hover:text-cyan-300 ${className}`}
    >
      {WITH_ICON && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/youtube-icon.svg" alt="" width={20} height={14} aria-hidden="true" />
      )}
      <span>{text}</span>
      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M3 9L9 3M9 3H4M9 3V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </a>
  );
}

/**
 * The derived-metrics disclosure.
 *
 * `long` sits under the stat strip and in the footer; `short` sits inside each
 * automation meter. Both link to the methodology page, which is what an actual
 * compliance review would be pointed at.
 */
export function Disclosure({ variant = "long" }: { variant?: "long" | "short" }) {
  if (variant === "short") {
    return (
      <p className="font-mono text-[10px] leading-relaxed text-zinc-600">
        PAID LLC estimate, not a YouTube metric. Aggregate only.
      </p>
    );
  }

  return (
    <p className="max-w-3xl font-mono text-[11px] leading-relaxed text-zinc-600">
      Sentiment, themes and automation figures are PAID LLC&apos;s own estimates,
      computed from public comments. They are not YouTube metrics, and they describe
      each comment section in aggregate, never any individual account. Comment text,
      video titles and statistics come from YouTube and belong to their authors.{" "}
      <Link href="/comments/about" className="text-zinc-500 underline decoration-zinc-700 underline-offset-2 transition-colors hover:text-cyan-300">
        How this is built
      </Link>
      .
    </p>
  );
}

/** The footer line: attribution, retention, and non-affiliation in one place. */
export function AttributionFooter() {
  return (
    <p className="max-w-3xl font-mono text-[11px] leading-relaxed text-zinc-600">
      Video titles, thumbnails, comment text and statistics come from YouTube and
      belong to their creators. Stored comment data is re-checked against YouTube
      within 30 days, and anything deleted there is removed here. PAID LLC is not
      affiliated with or endorsed by YouTube.
    </p>
  );
}
