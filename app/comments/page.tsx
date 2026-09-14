export const runtime = "edge";

// ── /comments ────────────────────────────────────────────────────────────────
// The latest published edition. Deploys before any data exists and renders an
// empty state until the first cron run, so the route, the nav entry and the
// subscribe form can all go live ahead of the pipeline.

import type { Metadata } from "next";
import { cache } from "react";
import { Edition } from "@/components/comments/Edition";
import { EmptyEdition } from "@/components/comments/EmptyEdition";
import { getEditionBundle, listEditions } from "@/lib/comments/store";
import { formatEditionDate } from "@/lib/comments/render-helpers";

// One fetch per request shared between generateMetadata and the body.
const load = cache(async () => {
  const bundle = await getEditionBundle("latest");
  const recent = await listEditions(14);
  return { bundle, recent };
});

export async function generateMetadata(): Promise<Metadata> {
  const { bundle } = await load();
  const title = "The Comment Section | paiddev.com";
  const description =
    bundle?.edition.teaser ??
    bundle?.edition.headline ??
    "Every morning, the most-watched videos in the United States, read through their comment sections. Sentiment, bot estimates, and the funniest comment nobody liked.";

  return {
    title,
    description,
    openGraph: {
      title: bundle?.edition.headline ?? title,
      description,
      url: "https://paiddev.com/comments",
      siteName: "PAID LLC",
      type: "website",
      images: [{ url: "https://paiddev.com/og/comments.png", width: 1200, height: 630, alt: "The Comment Section" }],
    },
    twitter: {
      card: "summary_large_image",
      title: bundle?.edition.headline ?? title,
      description,
      images: ["https://paiddev.com/og/comments.png"],
      creator: "@paiddevllc",
    },
    alternates: {
      canonical: "https://paiddev.com/comments",
      types: { "application/rss+xml": "https://paiddev.com/comments/rss.xml" },
    },
  };
}

export default async function CommentsPage() {
  const { bundle, recent } = await load();
  if (!bundle) return <EmptyEdition />;

  const jsonLd = {
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
    about: bundle.videos
      .filter((v) => v.status === "analyzed")
      .map((v) => ({
        "@type": "VideoObject",
        name: v.title,
        url: `https://www.youtube.com/watch?v=${v.video_id}`,
        thumbnailUrl: v.thumbnail_url ?? undefined,
      })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Edition bundle={bundle} recent={recent} />
      <span className="sr-only">
        Edition for {formatEditionDate(bundle.edition.edition_date)}
      </span>
    </>
  );
}
