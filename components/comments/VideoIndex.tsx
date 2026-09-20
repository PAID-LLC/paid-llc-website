"use client";

// ── The video index ──────────────────────────────────────────────────────────
// Every video ever analyzed, grouped by month, with a filter box.
//
// WHY THIS IS A CLIENT COMPONENT, in a folder where everything else is a server
// component on purpose: the filter has to be instant and it has to work on the
// whole list, not a page of it. Typing "iphone" and waiting on a round trip to
// Supabase would be slower and would cost a query per keystroke, for a list the
// page already holds in memory. So the server sends the rows once and the
// filtering happens here, with no fetch, no API route and no state anywhere.
//
// The rows are deliberately narrow (VideoIndexRow, not VideoRow). See the type's
// comment: whole rows would put megabytes of histograms into this payload.
//
// RETENTION: titles and channel names here are YouTube data on the 30-day clock.
// They stay legal because the daily refresh step re-verifies every analyzed
// video's title, channel and thumbnail. If that step ever stops running, this
// page is one of the surfaces that goes stale, which is why the refresh warns
// loudly on repeated failure rather than failing quietly.

import { useMemo, useState } from "react";
import Link from "next/link";
import { v2 } from "@/components/v2/tokens";
import { formatCount, formatShortDate, videoPath } from "@/lib/comments/render-helpers";
import type { VideoIndexRow } from "@/lib/comments/types";

function monthOf(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Every term has to appear somewhere, so "iphone jerry" narrows rather than widens. */
function matches(row: VideoIndexRow, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const hay = `${row.title} ${row.channel_title} ${row.first_edition}`.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

export function VideoIndex({ rows, truncated }: { rows: VideoIndexRow[]; truncated: boolean }) {
  const [query, setQuery] = useState("");

  const terms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query]
  );

  const groups = useMemo(() => {
    const byMonth = new Map<string, VideoIndexRow[]>();
    let shown = 0;
    for (const row of rows) {
      if (!matches(row, terms)) continue;
      shown++;
      const key = monthOf(row.first_edition);
      const list = byMonth.get(key);
      if (list) list.push(row);
      else byMonth.set(key, [row]);
    }
    return { entries: [...byMonth.entries()], shown };
  }, [rows, terms]);

  return (
    <>
      <div className={`${v2.section} pb-10`}>
        <label htmlFor="video-filter" className="sr-only">
          Filter videos by title or channel
        </label>
        <input
          id="video-filter"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by title or channel"
          autoComplete="off"
          className="w-full max-w-md rounded-md border border-white/[0.12] bg-white/[0.03] px-4 py-3 font-mono text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-cyan-400/60 focus:outline-none"
        />
        <p className="mt-3 font-mono text-[11px] text-zinc-600" aria-live="polite">
          {terms.length === 0
            ? `${formatCount(rows.length)} ${rows.length === 1 ? "video" : "videos"}${
                truncated ? ", most recent first" : ""
              }`
            : `${formatCount(groups.shown)} of ${formatCount(rows.length)} ${
                groups.shown === 1 ? "match" : "matches"
              }`}
        </p>
      </div>

      {groups.shown === 0 ? (
        <section className={v2.divider}>
          <div className={`${v2.section} py-12`}>
            <p className={v2.body}>
              Nothing matches “{query.trim()}”. Every edition is also listed by date in the{" "}
              <Link href="/comments/archive" className="text-cyan-300 transition-colors hover:text-cyan-200">
                archive
              </Link>
              .
            </p>
          </div>
        </section>
      ) : (
        groups.entries.map(([month, list]) => (
          <section key={month} className={v2.divider}>
            <div className={`${v2.section} py-12`}>
              <p className={v2.kicker}>{month}</p>
              <ul className="mt-6 space-y-3">
                {list.map((row) => (
                  <li key={row.video_id}>
                    <Link
                      href={videoPath(row.video_id)}
                      className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 border-l border-white/[0.08] py-2 pl-4 transition-colors hover:border-cyan-400/40"
                    >
                      <span className="w-24 shrink-0 font-mono text-[11px] text-zinc-600">
                        {formatShortDate(row.first_edition)}
                      </span>
                      {/* basis-full puts the title on its own line on a phone.
                          Without it the two fixed-width columns below sit beside
                          it and crush the title to one word per line. */}
                      <span className="basis-full text-sm text-zinc-300 transition-colors group-hover:text-cyan-300 sm:min-w-0 sm:flex-1">
                        {row.title}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-zinc-500 sm:w-44">
                        {row.channel_title}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-zinc-600 sm:w-28 sm:text-right">
                        {row.analyzed ? `${formatCount(row.analyzed)} comments` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))
      )}
    </>
  );
}
