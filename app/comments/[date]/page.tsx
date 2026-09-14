export const runtime = "edge";

// ── /comments/[date] ─────────────────────────────────────────────────────────
// One archived edition. Same component as the front page, so the archive can
// never render differently from how the day originally looked.
//
// The date is validated as a real calendar date before it reaches Supabase:
// "2026-02-31" and "../../etc/passwd" both 404 rather than becoming a query.

import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { Edition } from "@/components/comments/Edition";
import { getEditionBundle, listEditions } from "@/lib/comments/store";
import { isValidEditionDate, formatEditionDate } from "@/lib/comments/render-helpers";

const load = cache(async (date: string) => {
  if (!isValidEditionDate(date)) return null;
  const bundle = await getEditionBundle(date);
  if (!bundle) return null;
  return { bundle, recent: await listEditions(14) };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  const data = await load(date);
  if (!data) return { title: "Edition not found | paiddev.com" };

  const { edition } = data.bundle;
  const title = `${formatEditionDate(edition.edition_date)} | The Comment Section`;
  const description = edition.teaser ?? edition.headline ?? "";

  return {
    title,
    description,
    openGraph: {
      title: edition.headline ?? title,
      description,
      url: `https://paiddev.com/comments/${edition.edition_date}`,
      siteName: "PAID LLC",
      type: "article",
      publishedTime: edition.published_at ?? undefined,
      images: [{ url: "https://paiddev.com/og/comments.png", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: edition.headline ?? title,
      description,
      images: ["https://paiddev.com/og/comments.png"],
      creator: "@paiddevllc",
    },
    alternates: { canonical: `https://paiddev.com/comments/${edition.edition_date}` },
  };
}

export default async function EditionPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const data = await load(date);
  if (!data) notFound();

  const { bundle, recent } = data;

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
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Edition bundle={bundle} recent={recent} />
    </>
  );
}
