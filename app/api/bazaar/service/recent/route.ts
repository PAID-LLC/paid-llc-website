import { NextResponse } from "next/server";
import { sbUrl, sbHeaders, supabaseReady } from "@/lib/supabase";

export const runtime = "edge";

// ── Public settlement tail ────────────────────────────────────────────────────
// Sanitized public feed of the most recent SETTLED Bazaar jobs, consumed by the
// homepage AgentTransactionLog live tail (Gemini spec item 3, 2026-07-05).
// Deliberately excluded: buyer identity, job input, job result — buyer inputs
// are private (QA retention finding, references/qa/2026-07-05 dogfood) and the
// Bearer-authed /api/bazaar/service/jobs remains the only way to read a job
// body. This endpoint exposes only what a public trade ticker would: what was
// bought, from whom, for how much, when. Fails soft (empty list) so the
// homepage never breaks on a Supabase hiccup.

interface JobRow {
  price_credits: number;
  settled_at: string | null;
  seller_agent: string;
  catalog: { title: string } | null;
}

export async function GET() {
  const empty = NextResponse.json(
    { jobs: [] },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
  if (!supabaseReady()) return empty;

  const res = await fetch(
    sbUrl(
      "agent_service_jobs" +
        "?select=price_credits,settled_at,seller_agent,catalog:agent_catalog(title)" +
        "&status=eq.settled&order=settled_at.desc&limit=6"
    ),
    { headers: sbHeaders() }
  ).catch(() => null);
  if (!res || !res.ok) return empty;

  const rows = (await res.json()) as JobRow[];
  const jobs = rows
    .filter((r) => r.settled_at)
    .map((r) => ({
      title: (r.catalog?.title ?? "service").slice(0, 60),
      seller: r.seller_agent.slice(0, 40),
      credits: r.price_credits,
      settled_at: r.settled_at,
    }));

  return NextResponse.json(
    { jobs },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}
