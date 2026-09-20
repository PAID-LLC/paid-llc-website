export const runtime = "edge";

// ── /comments/videos ─────────────────────────────────────────────────────────
// Every video ever analyzed, in one filterable list.
//
// WHY IT EXISTS. The archive answers "what ran on the 19th". Nothing answered
// "where is the iPhone durability one", and at five videos a day that gap grows
// by five permanent pages every morning: a year of publishing is roughly 1,800
// video pages reachable only by guessing a date. This is the page that makes
// the back catalogue browsable instead of merely stored.
//
// One query, capped. See listAnalyzedVideos: narrow rows, JSONB read by path, so
// the payload is titles rather than histograms.

import type { Metadata } from "next";
import Link from "next/link";
import { listAnalyzedVideos } from "@/lib/comments/store";
import { v2 } from "@/components/v2/tokens";
import { VideoIndex } from "@/components/comments/VideoIndex";

// The ceiling is a year and a half of publishing. Past it the page lists the
// most recent and says so; that is the point to add real pagination, not now.
const MAX_ROWS = 2500;

export const metadata: Metadata = {
  title: "Every video | The Comment Section | paiddev.com",
  description:
    "Every video The Comment Section has read the comments on, by title, channel and date. Filter to find one again.",
  alternates: { canonical: "https://paiddev.com/comments/videos" },
};

export default async function VideosPage() {
  const rows = await listAnalyzedVideos(MAX_ROWS);

  return (
    <>
      <section className={`${v2.section} pt-20 pb-10`}>
        <p className={v2.kicker}>
          <Link href="/comments" className="transition-colors hover:text-cyan-300">
            The Comment Section
          </Link>
        </p>
        <h1 className={`${v2.h1} mt-6 !text-3xl sm:!text-5xl`}>
          Every <span className="text-cyan-400">video</span>.
        </h1>
        <p className={`${v2.body} mt-5 max-w-2xl`}>
          {rows.length === 0
            ? "Nothing analyzed yet. The first edition prints tomorrow morning."
            : "Everything the comment sections have been read on, newest first. Type to find one again, by title or by channel."}
        </p>
        <p className={`${v2.bodySm} mt-4`}>
          Looking for a particular day instead?{" "}
          <Link
            href="/comments/archive"
            className="text-cyan-300 transition-colors hover:text-cyan-200"
          >
            The archive lists every edition by date
          </Link>
          .
        </p>
      </section>

      {rows.length > 0 && <VideoIndex rows={rows} truncated={rows.length === MAX_ROWS} />}
    </>
  );
}
