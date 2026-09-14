export const runtime = "edge";

// ── /comments/v/[videoId] ────────────────────────────────────────────────────
// One video's full breakdown, and the page most likely to be shared: a link to
// "the analysis of THAT video" travels further than a link to a daily edition.
//
// Its OG image is the video's own thumbnail. That is safe despite the page's
// img-src CSP allowing only i.ytimg.com for the browser, because og:image is a
// meta tag read by crawlers (X, Slack, LinkedIn, iMessage) that fetch it
// server-to-server and never evaluate the page's Content-Security-Policy.

import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VideoCard } from "@/components/comments/VideoCard";
import { Disclosure, AttributionFooter } from "@/components/comments/Attribution";
import { getVideoBundle, listEditions } from "@/lib/comments/store";
import { v2 } from "@/components/v2/tokens";
import {
  isValidVideoId,
  formatEditionDate,
  formatShortDate,
  editionPath,
  truncate,
} from "@/lib/comments/render-helpers";

const load = cache(async (videoId: string) => {
  if (!isValidVideoId(videoId)) return null;
  return getVideoBundle(videoId);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ videoId: string }>;
}): Promise<Metadata> {
  const { videoId } = await params;
  const data = await load(videoId);
  if (!data) return { title: "Not found | paiddev.com" };

  const { video } = data;
  const title = `${truncate(video.title, 60)} | The Comment Section`;
  const a = video.analysis;
  const description =
    a.vibe ||
    `What ${video.channel_title}'s comment section actually said: sentiment, themes, and the funniest overlooked comment.`;
  const image = video.thumbnail_url ?? "https://paiddev.com/og/comments.png";

  return {
    title,
    description,
    openGraph: {
      title: video.title,
      description,
      url: `https://paiddev.com/comments/v/${video.video_id}`,
      siteName: "PAID LLC",
      type: "article",
      images: [{ url: image, width: 1280, height: 720, alt: video.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: video.title,
      description,
      images: [image],
      creator: "@paiddevllc",
    },
    alternates: { canonical: `https://paiddev.com/comments/v/${video.video_id}` },
  };
}

export default async function VideoPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const data = await load(videoId);
  if (!data) notFound();

  const { video, featured } = data;
  const recent = await listEditions(8);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `What ${video.channel_title}'s comment section said`,
    url: `https://paiddev.com/comments/v/${video.video_id}`,
    description: video.analysis.vibe,
    author: { "@type": "Organization", name: "PAID LLC", url: "https://paiddev.com" },
    publisher: { "@id": "https://paiddev.com/#organization" },
    about: {
      "@type": "VideoObject",
      name: video.title,
      url: `https://www.youtube.com/watch?v=${video.video_id}`,
      thumbnailUrl: video.thumbnail_url ?? undefined,
      uploadDate: video.published_at ?? undefined,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className={`${v2.section} pt-20 pb-8`}>
        <p className={v2.kicker}>
          <Link href="/comments" className="transition-colors hover:text-cyan-300">
            The Comment Section
          </Link>
          {video.first_edition && (
            <>
              {" · "}
              <Link
                href={editionPath(video.first_edition)}
                className="transition-colors hover:text-cyan-300"
              >
                {formatEditionDate(video.first_edition)}
              </Link>
            </>
          )}
        </p>
        <h1 className={`${v2.h1} mt-5 max-w-4xl !text-2xl sm:!text-4xl`}>
          What the comments said about{" "}
          <span className="text-cyan-400">{truncate(video.title, 70)}</span>
        </h1>
      </section>

      <section className={v2.divider}>
        <div className={`${v2.section} py-12`}>
          <VideoCard video={video} featured={featured} rank={0} expanded />
        </div>
      </section>

      {recent.length > 0 && (
        <section className={v2.divider}>
          <div className={`${v2.section} py-12`}>
            <p className={v2.kicker}>More editions</p>
            <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
              {recent.map((e) => (
                <Link
                  key={e.edition_date}
                  href={editionPath(e.edition_date)}
                  className="shrink-0 rounded-md border border-white/10 px-3 py-1.5 font-mono text-[11px] text-zinc-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
                >
                  {formatShortDate(e.edition_date)}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={v2.divider}>
        <div className={`${v2.section} py-10`}>
          <Disclosure />
          <div className="mt-3">
            <AttributionFooter />
          </div>
        </div>
      </section>
    </>
  );
}
