// ── One video's card ─────────────────────────────────────────────────────────
// The unit the edition is built from. Two columns on desktop: the video on the
// left, what its comment section was actually like on the right.
//
// `expanded` is the permalink variant: same component, more of everything, so
// /comments/v/<id> cannot drift away from how the card looks on the front page.
//
// Skipped videos render a slim row instead of a card. Showing them matters —
// an edition that silently dropped from five videos to three would read as a
// thin day rather than as two videos with comments turned off.

import Link from "next/link";
import { YouTubeMark } from "./Attribution";
import { CommentQuote } from "./CommentQuote";
import { SentimentBar, VelocitySparkline, AutomationMeter } from "./Charts";
import { v2 } from "@/components/v2/tokens";
import {
  formatCount,
  formatDuration,
  videoPath,
  truncate,
} from "@/lib/comments/render-helpers";
import type { VideoRow, FeaturedRow } from "@/lib/comments/types";

const SKIP_COPY: Record<string, string> = {
  comments_disabled: "Comments are turned off on this one.",
  too_few_comments: "Too few comments to read anything into.",
  non_english_comments: "The comment section is mostly not in English, which this analysis cannot read.",
};

export function VideoCard({
  video,
  featured,
  rank,
  expanded = false,
  heroCommentId,
}: {
  video: VideoRow;
  featured: FeaturedRow[];
  rank: number;
  expanded?: boolean;
  /** The edition's own hero pick, so this card does not reprint it. */
  heroCommentId?: string | null;
}) {
  if (video.status === "skipped") return <SkippedRow video={video} rank={rank} />;

  const a = video.analysis;
  const allRunnersUp = featured.filter((f) => f.role === "runner_up");

  // When this video supplied the edition's headline comment, that quote is
  // already running at full size a few hundred pixels up the page. Showing it
  // again here reads as a bug, so the card promotes its runner-up instead and
  // every card still carries a quote.
  const ownFunniest = featured.find((f) => f.role === "funniest");
  const heroIsHere = !!heroCommentId && ownFunniest?.comment_id === heroCommentId;
  const funniest = heroIsHere ? allRunnersUp[0] : ownFunniest;
  const runnersUp = heroIsHere ? allRunnersUp.slice(1) : allRunnersUp;
  const top = featured.filter((f) => f.role === "top").sort((x, y) => x.position - y.position);

  return (
    <article className={`${v2.cardStatic} v2-reveal`}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* ── The video ───────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-start gap-3">
            <span className="font-mono text-2xl font-bold leading-none text-[#E8714C]">
              {String(rank + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h3 className={`${v2.h3} leading-snug`}>
                {expanded ? video.title : truncate(video.title, 90)}
              </h3>
              <p className="mt-1 font-mono text-[11px] text-zinc-500">{video.channel_title}</p>
            </div>
          </div>

          {video.thumbnail_url && (
            <a
              href={`https://www.youtube.com/watch?v=${video.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block overflow-hidden rounded-lg border border-white/[0.08]"
            >
              {/* Plain img: next/image is unoptimized on Cloudflare Pages anyway
                  (next.config.ts), and this avoids the extra client runtime. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={video.thumbnail_url}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-video w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
              />
            </a>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-zinc-500">
            {video.stats.views !== undefined && <span>{formatCount(video.stats.views)} views</span>}
            {video.stats.views_per_hour ? (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className="text-[#E8714C]"
                  title="Average views per hour since upload, when this edition was picked. The edition ranks by this."
                >
                  {formatCount(video.stats.views_per_hour)}/hr
                </span>
              </>
            ) : null}
            {a.analyzed !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <span>{formatCount(a.analyzed)} comments read</span>
              </>
            )}
            {video.duration_s ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{formatDuration(video.duration_s)}</span>
              </>
            ) : null}
          </div>

          <div className="mt-2">
            <YouTubeMark videoId={video.video_id} />
          </div>
        </div>

        {/* ── What the comments were like ─────────────────────────────────── */}
        <div className="min-w-0">
          {video.summary ? (
            <p className={v2.body}>{video.summary}</p>
          ) : (
            <p className={`${v2.bodySm} italic`}>
              No description available for this one today.
            </p>
          )}

          {a.vibe && <p className="mt-3 text-base leading-relaxed text-cyan-300/90">{a.vibe}</p>}

          {a.themes && a.themes.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {a.themes.slice(0, expanded ? 8 : 3).map((theme) => (
                <span key={theme} className={v2.chip}>
                  {theme}
                </span>
              ))}
            </div>
          )}

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                The mood
              </p>
              <SentimentBar
                shares={{
                  positive: a.positiveShare ?? 0,
                  neutral: a.neutralShare ?? 0,
                  negative: a.negativeShare ?? 0,
                }}
                analyzed={a.analyzed ?? 0}
              />
              {a.emoji && a.emoji.length > 0 && (
                <p className="mt-3 font-mono text-[11px] text-zinc-500">
                  {a.emoji.slice(0, 5).map((e) => (
                    <span key={e.char} className="mr-3">
                      {e.char} {formatCount(e.count)}
                    </span>
                  ))}
                </p>
              )}
            </div>

            <div>
              {a.automation && <AutomationMeter automation={a.automation} />}
            </div>
          </div>

          {expanded && a.velocity && (
            <div className="mt-5">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                When people showed up
              </p>
              <VelocitySparkline velocity={a.velocity} busiestHour={a.busiestHour ?? 0} />
            </div>
          )}

          {/* The crowd's pick first, then ours: the most-liked comment is what
              the section agreed on, and the underrated one below is the
              contrast the whole page is built around. The permalink page
              shows all three most-liked, so this is the collapsed card only. */}
          {!expanded && top[0] && (
            <div className="mt-6">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Most liked
              </p>
              <CommentQuote comment={top[0]} videoId={video.video_id} />
            </div>
          )}

          {funniest && (
            <div className="mt-6 rounded-lg border border-white/[0.06] bg-[#0b0b12] p-4">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[#E8714C]">
                {heroIsHere ? "Also underrated here" : "Underrated here"}
              </p>
              <CommentQuote comment={funniest} videoId={video.video_id} showWhy />
            </div>
          )}

          {expanded && runnersUp.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Also overlooked
              </p>
              <div className="space-y-4">
                {runnersUp.map((c) => (
                  <CommentQuote key={c.comment_id} comment={c} videoId={video.video_id} />
                ))}
              </div>
            </div>
          )}

          {expanded && top.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Most liked
              </p>
              <div className="space-y-4">
                {top.map((c) => (
                  <CommentQuote key={c.comment_id} comment={c} videoId={video.video_id} />
                ))}
              </div>
            </div>
          )}

          {!expanded && (
            <Link
              href={videoPath(video.video_id)}
              className="mt-5 inline-flex items-center gap-1.5 font-mono text-xs text-cyan-300 transition-colors hover:text-cyan-200"
            >
              Full breakdown
              <span aria-hidden="true">→</span>
            </Link>
          )}

          {a.degraded && a.degraded.length > 0 && (
            <p className="mt-4 font-mono text-[10px] text-zinc-600">
              {a.summarySource === "text"
                ? "Description written from the title and top comments; the video itself could not be read today."
                : a.summarySource === "none"
                  ? "No description generated today."
                  : ""}
              {a.degraded.includes("editorial:fallback") &&
                " The pick below was ranked in code rather than judged."}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function SkippedRow({ video, rank }: { video: VideoRow; rank: number }) {
  return (
    <article className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-5 py-4">
      <span className="font-mono text-sm font-bold text-zinc-600">
        {String(rank + 1).padStart(2, "0")}
      </span>
      <h3 className="min-w-0 flex-1 font-mono text-sm text-zinc-400">
        {truncate(video.title, 70)}
      </h3>
      <span className="font-mono text-[11px] text-zinc-600">
        {SKIP_COPY[video.skip_reason ?? ""] ?? "Skipped today."}
      </span>
      <YouTubeMark videoId={video.video_id} />
    </article>
  );
}
