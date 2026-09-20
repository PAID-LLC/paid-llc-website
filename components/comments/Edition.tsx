// ── The front page ───────────────────────────────────────────────────────────
// Composes one edition, top to bottom. Used by /comments (latest) and
// /comments/[date] (archive), so the two can never drift apart.
//
// The order is a newspaper's, not a dashboard's: the headline, then the one
// thing worth reading today, then the five stories, then the housekeeping.
// Numbers are near the top because they are the credential; the joke is above
// the videos because it is the reason anyone stays.
//
// Two-tone discipline (references/DESIGN_GUIDELINES.md): terracotta leads each
// section, cyan partners it, and nothing else is coloured. Amber appears in
// exactly one place, an elevated automation meter, where it means something.

import Link from "next/link";
import { VideoCard } from "./VideoCard";
import { CommentQuote } from "./CommentQuote";
import { SentimentRing } from "./Charts";
import { Disclosure, AttributionFooter, YouTubeMark } from "./Attribution";
import { SubscribeForm } from "./SubscribeForm";
import { v2 } from "@/components/v2/tokens";
import { houseAdFor } from "@/lib/comments/house-ads";
import { STANDFIRST } from "@/lib/comments/headline";
import {
  formatCount,
  formatEditionDate,
  formatShortDate,
  editionPath,
  pct,
  ordinal,
} from "@/lib/comments/render-helpers";
import type { EditionBundle, EditionRow } from "@/lib/comments/types";

export function Edition({
  bundle,
  recent,
}: {
  bundle: EditionBundle;
  recent: EditionRow[];
}) {
  const { edition, videos, featured } = bundle;
  const stats = edition.stats;
  const analyzed = videos.filter((v) => v.status === "analyzed");
  const skipped = videos.filter((v) => v.status === "skipped");

  const hero = featured.find((f) => f.comment_id === edition.hero_comment_id);
  const heroVideo = hero ? videos.find((v) => v.video_id === hero.video_id) : undefined;

  const ad = houseAdFor(edition.edition_date);
  const idx = recent.findIndex((e) => e.edition_date === edition.edition_date);
  const newer = idx > 0 ? recent[idx - 1] : null;
  const older = idx >= 0 && idx < recent.length - 1 ? recent[idx + 1] : null;

  return (
    <>
      {/* ── 1. Masthead ──────────────────────────────────────────────────── */}
      <section className={`${v2.section} pt-20 pb-10`}>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <p className={v2.kicker}>
            The Comment Section
            {edition.edition_no ? ` · No. ${edition.edition_no}` : ""} ·{" "}
            {formatEditionDate(edition.edition_date)}
          </p>
          <div className="flex items-center gap-4 font-mono text-[11px] text-zinc-500">
            {newer && (
              <Link href={editionPath(newer.edition_date)} className="transition-colors hover:text-cyan-300">
                ← {formatShortDate(newer.edition_date)}
              </Link>
            )}
            {older && (
              <Link href={editionPath(older.edition_date)} className="transition-colors hover:text-cyan-300">
                {formatShortDate(older.edition_date)} →
              </Link>
            )}
            {/* Both of these live here rather than only in the rail below,
                because the rail is hidden until a second edition exists and
                these are the two ways to find anything already published. */}
            <Link href="/comments/archive" className="transition-colors hover:text-cyan-300">
              archive
            </Link>
            <Link href="/comments/videos" className="transition-colors hover:text-cyan-300">
              every video
            </Link>
          </div>
        </div>

        <div className="mt-5 h-px w-full origin-left bg-gradient-to-r from-[#C14826]/60 via-white/[0.08] to-transparent cs-grow" />

        <h1 className={`${v2.h1} mt-7 max-w-4xl !text-3xl sm:!text-5xl`}>
          {edition.headline}
        </h1>
        <p className={`${v2.body} mt-5 max-w-2xl text-lg`}>{STANDFIRST}</p>
      </section>

      {/* ── 2. The numbers ───────────────────────────────────────────────── */}
      <section className={v2.divider}>
        <div className={`${v2.section} py-12`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={`${v2.cardStatic} !border-[#C14826]/30`}>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Comments read
              </p>
              <p className="mt-3 font-mono text-4xl font-bold text-zinc-100">
                {formatCount(stats.commentsAnalyzed ?? 0)}
              </p>
              <p className="mt-1 font-mono text-[11px] text-zinc-600">
                across {analyzed.length} {analyzed.length === 1 ? "video" : "videos"}
              </p>
            </div>

            <div className={`${v2.cardStatic} flex items-center gap-4`}>
              <SentimentRing
                shares={{
                  positive: stats.positiveShare ?? 0,
                  neutral: stats.neutralShare ?? 0,
                  negative: stats.negativeShare ?? 0,
                }}
                size={88}
              />
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Positive
                </p>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-zinc-600">
                  {pct(stats.negativeShare ?? 0)} negative
                  <br />
                  {pct(stats.neutralShare ?? 0)} neutral
                </p>
              </div>
            </div>

            <div className={v2.cardStatic}>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Estimated automated
              </p>
              <p
                className={`mt-3 font-mono text-4xl font-bold ${(stats.automationShare ?? 0) >= 0.15 ? "text-amber-300" : "text-zinc-100"}`}
              >
                {pct(stats.automationShare ?? 0)}
              </p>
              <p className="mt-1 font-mono text-[11px] text-zinc-600">our estimate, in aggregate</p>
            </div>

            <div className={v2.cardStatic}>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Busiest hour
              </p>
              <p className="mt-3 font-mono text-4xl font-bold text-zinc-100">
                {ordinal((stats.busiestHour ?? 0) + 1)}
              </p>
              <p className="mt-1 font-mono text-[11px] text-zinc-600">hour after upload</p>
            </div>
          </div>

          <div className="mt-6">
            <Disclosure />
          </div>
        </div>
      </section>

      {/* ── 3. The reason anyone stays ───────────────────────────────────── */}
      {hero && heroVideo && (
        <section className={v2.divider}>
          <div className={`${v2.section} py-16`}>
            <p className={v2.kicker}>Underrated comment of the day</p>

            <div className="mt-7 flex gap-6">
              <div className="w-px shrink-0 origin-top bg-[#C14826]/60 cs-rule" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <CommentQuote comment={hero} videoId={heroVideo.video_id} size="lg" showWhy />

                <div className="mt-6 flex items-center gap-4">
                  {heroVideo.thumbnail_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={heroVideo.thumbnail_url}
                      alt=""
                      loading="lazy"
                      className="h-14 w-24 shrink-0 rounded border border-white/[0.08] object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-zinc-500">Found under</p>
                    <Link
                      href={`/comments/v/${heroVideo.video_id}`}
                      className="block truncate text-sm text-zinc-300 transition-colors hover:text-cyan-300"
                    >
                      {heroVideo.title}
                    </Link>
                    <p className="mt-0.5 font-mono text-[11px] text-zinc-600">
                      {heroVideo.channel_title}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Today's videos ────────────────────────────────────────────── */}
      <section className={v2.divider}>
        <div className={`${v2.section} py-16`}>
          <p className={v2.kicker}>
            {analyzed.length === 1 ? "Today's video" : `Today's ${numberWord(analyzed.length)}`}
          </p>
          <h2 className={`${v2.h2} mt-4 max-w-2xl`}>
            What the <span className="text-cyan-400">comments</span> said.
          </h2>

          <div className="mt-10 space-y-6">
            {analyzed.map((video, i) => (
              <VideoCard
                key={video.video_id}
                video={video}
                featured={featured.filter((f) => f.video_id === video.video_id)}
                rank={i}
                heroCommentId={edition.hero_comment_id}
              />
            ))}
          </div>

          {skipped.length > 0 && (
            <div className="mt-6 space-y-3">
              {skipped.map((video, i) => (
                <VideoCard
                  key={video.video_id}
                  video={video}
                  featured={[]}
                  rank={analyzed.length + i}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 5. Past editions ─────────────────────────────────────────────── */}
      {recent.length > 1 && (
        <section className={v2.divider}>
          <div className={`${v2.section} py-12`}>
            <p className={v2.kicker}>Past editions</p>
            <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
              {recent.map((e) => {
                const current = e.edition_date === edition.edition_date;
                return (
                  <Link
                    key={e.edition_date}
                    href={editionPath(e.edition_date)}
                    className={`shrink-0 rounded-md border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                      current
                        ? "border-[#C14826]/50 bg-[#C14826]/15 text-[#E8714C]"
                        : "border-white/10 text-zinc-400 hover:border-cyan-400/40 hover:text-cyan-300"
                    }`}
                  >
                    {formatShortDate(e.edition_date)}
                  </Link>
                );
              })}
              <Link
                href="/comments/archive"
                className="shrink-0 rounded-md border border-white/10 px-3 py-1.5 font-mono text-[11px] text-zinc-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
              >
                all editions →
              </Link>
              <Link
                href="/comments/videos"
                className="shrink-0 rounded-md border border-white/10 px-3 py-1.5 font-mono text-[11px] text-zinc-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
              >
                every video →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── 6. Subscribe ─────────────────────────────────────────────────── */}
      <section className={v2.divider}>
        <div className={`${v2.section} py-16`}>
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className={v2.kicker}>Get it in your inbox</p>
              <h2 className={`${v2.h2} mt-4`}>
                One email a morning.
                <br />
                <span className="text-cyan-400">The comment nobody saw.</span>
              </h2>
              <p className={`${v2.body} mt-4 max-w-md`}>
                The five videos, the numbers, and the joke that got two likes. No
                other mail, and one click to stop.
              </p>
            </div>
            <div className={v2.cardStatic}>
              <SubscribeForm />
              <p className="mt-4 font-mono text-[11px] text-zinc-600">
                Prefer a feed?{" "}
                <a href="/comments/rss.xml" className="text-cyan-300 transition-colors hover:text-cyan-200">
                  RSS
                </a>
                {" · "}
                <a href="/api/comments/edition" className="text-cyan-300 transition-colors hover:text-cyan-200">
                  JSON
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Sponsor ───────────────────────────────────────────────────── */}
      <section className={v2.divider}>
        <div className={`${v2.section} py-12`}>
          <div className={`${v2.cardStatic} flex flex-wrap items-center justify-between gap-6`}>
            <div className="min-w-0 max-w-xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                {ad.eyebrow}
              </p>
              <h3 className={`${v2.h3} mt-2`}>{ad.title}</h3>
              <p className={`${v2.bodySm} mt-2`}>{ad.body}</p>
            </div>
            <div className="flex flex-col items-start gap-2">
              <Link href={ad.href} className={v2.btnGhost}>
                {ad.cta}
              </Link>
              <a
                href="/contact"
                className="font-mono text-[10px] text-zinc-600 transition-colors hover:text-zinc-400"
              >
                This slot is available
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. The legal footing ─────────────────────────────────────────── */}
      <section className={v2.divider}>
        <div className={`${v2.section} py-10`}>
          <Disclosure />
          <div className="mt-3">
            <AttributionFooter />
          </div>
          <div className="mt-4">
            <YouTubeMark
              videoId={analyzed[0]?.video_id}
              label="Source: YouTube"
            />
          </div>
        </div>
      </section>
    </>
  );
}

function numberWord(n: number): string {
  return ["zero", "one", "two", "three", "four", "five", "six", "seven"][n] ?? String(n);
}
