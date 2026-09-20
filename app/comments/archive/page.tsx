export const runtime = "edge";

// ── /comments/archive ────────────────────────────────────────────────────────
// Every edition, grouped by month. This is the SEO surface: the daily page is
// one URL that changes, the archive is where the accumulated pages live and
// where a crawler finds them all.
//
// Each row also names the videos that ran that day, because a headline alone
// does not answer "which day was the iPhone one". Titles come from one extra
// query rather than one per edition, and they are rendered as a single muted
// line: the row links to the edition, so five more links here would be five
// more things to miss the target on. Finding a video WITHOUT knowing its date
// is /comments/videos, which is linked below the heading.

import type { Metadata } from "next";
import Link from "next/link";
import { listEditions, listAnalyzedVideos } from "@/lib/comments/store";
import { v2 } from "@/components/v2/tokens";
import { formatEditionDate, editionPath, formatCount, truncate } from "@/lib/comments/render-helpers";
import type { EditionRow } from "@/lib/comments/types";

export const metadata: Metadata = {
  title: "Archive | The Comment Section | paiddev.com",
  description: "Every edition of The Comment Section, by date.",
  alternates: { canonical: "https://paiddev.com/comments/archive" },
};

function monthOf(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function ArchivePage() {
  const editions = await listEditions(400);
  const videos = await listAnalyzedVideos(2500);

  const titlesByDate = new Map<string, string[]>();
  for (const v of videos) {
    const list = titlesByDate.get(v.first_edition);
    if (list) list.push(v.title);
    else titlesByDate.set(v.first_edition, [v.title]);
  }

  const byMonth = new Map<string, EditionRow[]>();
  for (const e of editions) {
    const key = monthOf(e.edition_date);
    const list = byMonth.get(key);
    if (list) list.push(e);
    else byMonth.set(key, [e]);
  }

  return (
    <>
      <section className={`${v2.section} pt-20 pb-10`}>
        <p className={v2.kicker}>
          <Link href="/comments" className="transition-colors hover:text-cyan-300">
            The Comment Section
          </Link>
        </p>
        <h1 className={`${v2.h1} mt-6 !text-3xl sm:!text-5xl`}>
          Every <span className="text-cyan-400">edition</span>.
        </h1>
        <p className={`${v2.body} mt-5`}>
          {editions.length === 0
            ? "Nothing published yet. The first edition prints tomorrow morning."
            : `${editions.length} ${editions.length === 1 ? "edition" : "editions"} so far.`}
        </p>
        <p className={`${v2.bodySm} mt-4`}>
          Know the video but not the day?{" "}
          <Link
            href="/comments/videos"
            className="text-cyan-300 transition-colors hover:text-cyan-200"
          >
            Every video is listed and filterable
          </Link>
          .
        </p>
      </section>

      {[...byMonth.entries()].map(([month, list]) => (
        <section key={month} className={v2.divider}>
          <div className={`${v2.section} py-12`}>
            <p className={v2.kicker}>{month}</p>
            <ul className="mt-6 space-y-3">
              {list.map((e) => (
                <li key={e.edition_date}>
                  <Link
                    href={editionPath(e.edition_date)}
                    className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 border-l border-white/[0.08] py-2 pl-4 transition-colors hover:border-cyan-400/40"
                  >
                    <span className="w-16 shrink-0 font-mono text-[11px] text-zinc-600">
                      {e.edition_no ? `No. ${e.edition_no}` : ""}
                    </span>
                    <span className="w-56 shrink-0 font-mono text-xs text-zinc-500">
                      {formatEditionDate(e.edition_date)}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-zinc-300 transition-colors group-hover:text-cyan-300">
                      {e.headline}
                    </span>
                    {e.stats?.commentsAnalyzed ? (
                      <span className="font-mono text-[11px] text-zinc-600">
                        {formatCount(e.stats.commentsAnalyzed)} comments
                      </span>
                    ) : null}
                    {titlesByDate.get(e.edition_date)?.length ? (
                      <span className="w-full font-mono text-[11px] leading-relaxed text-zinc-600">
                        {titlesByDate
                          .get(e.edition_date)!
                          .map((t) => truncate(t, 52))
                          .join("  ·  ")}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </>
  );
}
