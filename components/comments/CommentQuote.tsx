// ── A quoted comment ─────────────────────────────────────────────────────────
// Every comment shown anywhere on this page goes through here, which is what
// makes the display rules enforceable in one place:
//
//   - full text, never truncated (YouTube's Required Minimum Functionality)
//   - the author's name, linked to their channel
//   - a link to the comment itself, so the reader can see it in context
//   - a "since removed" state, because the refresh step nulls the text of any
//     comment deleted upstream and the page has to say so honestly rather than
//     render an empty quote or silently drop it
//
// The removed state is the one worth looking at. Our commentary about a comment
// is ours and survives; the comment itself is the author's and does not. So the
// card keeps the reasoning and replaces the quote with a plain statement.

import { YouTubeMark } from "./Attribution";
import { youtubeChannelUrl, relativeTime, formatCount } from "@/lib/comments/render-helpers";
import type { FeaturedRow } from "@/lib/comments/types";

export function CommentQuote({
  comment,
  videoId,
  size = "sm",
  showWhy = false,
}: {
  comment: FeaturedRow;
  videoId: string;
  size?: "sm" | "lg";
  showWhy?: boolean;
}) {
  const removed = !!comment.removed_at || !comment.text;
  const large = size === "lg";

  return (
    <figure className={large ? "" : "border-l border-white/[0.08] pl-4"}>
      {removed ? (
        <p className={`${large ? "text-lg" : "text-sm"} italic leading-relaxed text-zinc-500`}>
          This comment has since been removed from YouTube.
        </p>
      ) : (
        <blockquote
          className={
            large
              ? "font-mono text-xl leading-snug text-zinc-100 sm:text-2xl"
              : "text-sm leading-relaxed text-zinc-300"
          }
        >
          {/* Rendered as plain text: textFormat=plainText on the API call means
              there is no markup to sanitize, and React escapes it regardless. */}
          &ldquo;{comment.text}&rdquo;
        </blockquote>
      )}

      <figcaption
        className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono ${large ? "text-xs" : "text-[11px]"} text-zinc-500`}
      >
        {comment.author_channel_id ? (
          <a
            href={youtubeChannelUrl(comment.author_channel_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 transition-colors hover:text-cyan-300"
          >
            {comment.author_display || "Unknown"}
          </a>
        ) : (
          <span className="text-zinc-400">{comment.author_display || "Unknown"}</span>
        )}

        <span aria-hidden="true">·</span>
        <span>
          {formatCount(comment.like_count)} {comment.like_count === 1 ? "like" : "likes"}
        </span>

        {comment.published_at && (
          <>
            <span aria-hidden="true">·</span>
            <span>{relativeTime(comment.published_at)}</span>
          </>
        )}

        <YouTubeMark videoId={videoId} commentId={comment.comment_id} label="See it on YouTube" />
      </figcaption>

      {showWhy && comment.why && (
        <p className={`mt-3 ${large ? "text-base" : "text-sm"} leading-relaxed text-zinc-400`}>
          {comment.why}
        </p>
      )}
    </figure>
  );
}
