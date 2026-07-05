import { NextRequest, NextResponse } from "next/server";
import { sbUrl, sbHeaders, supabaseReady } from "@/lib/supabase";
import { sanitize, MESSAGE_CHARS, hashIp, extractIp } from "@/lib/api-utils";
import { sentinelCheck } from "@/lib/sentinel";
import { wardenReview } from "@/lib/agents/warden";
import { underDailyLimit } from "@/lib/usage-guard";

export const runtime = "edge";

// ── Guide reviews ─────────────────────────────────────────────────────────────
// Public reviews for the digital guides (Gemini spec item 2, 2026-07-05).
// Same governance stack as the Bazaar hire path: Sentinel regex screen first,
// then a strict Warden review (human-submitted public content fails CLOSED —
// an unadjudicated review lands as 'pending' for manual approval, never live).
// Table: guide_reviews (db/guide-reviews.sql), service-key only, RLS deny-all.

const SLUG_RE = /^[a-z0-9-]{3,80}$/;
const REVIEWS_DAILY_PER_IP = 5;

function isOriginAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // server-to-server or direct call — allow
  if (process.env.NODE_ENV === "development" && origin.startsWith("http://localhost:")) {
    return true;
  }
  const allowed = [
    "https://paiddev.com",
    "https://www.paiddev.com",
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter(Boolean);
  return allowed.includes(origin);
}

interface ReviewRow {
  rating: number;
  review_text: string;
  author_name: string;
  author_type: "human" | "agent";
  created_at: string;
}

// GET /api/guides/reviews?slug=<guide_slug> — approved reviews plus summary.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Valid slug required." }, { status: 400 });
  }
  if (!supabaseReady()) {
    return NextResponse.json({ error: "Reviews unavailable." }, { status: 503 });
  }

  const res = await fetch(
    sbUrl(
      `guide_reviews?guide_slug=eq.${slug}&status=eq.approved` +
        `&select=rating,review_text,author_name,author_type,created_at` +
        `&order=created_at.desc&limit=200`
    ),
    { headers: sbHeaders() }
  );
  if (!res.ok) {
    return NextResponse.json({ error: "Reviews unavailable." }, { status: 503 });
  }

  const rows = (await res.json()) as ReviewRow[];
  const count = rows.length;
  const avg = count
    ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
    : null;

  return NextResponse.json(
    { slug, count, avg, reviews: rows.slice(0, 20) },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}

// POST /api/guides/reviews — submit a review. Body:
// { slug, rating (1-5), review (10-1200 chars), name? }
export async function POST(req: NextRequest) {
  if (!isOriginAllowed(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (!supabaseReady()) {
    return NextResponse.json({ error: "Reviews unavailable." }, { status: 503 });
  }

  const ipHash = await hashIp(extractIp(req), "guide_reviews_2026");
  if (!(await underDailyLimit(`guide_review:${ipHash}`, REVIEWS_DAILY_PER_IP))) {
    return NextResponse.json(
      { error: "Too many reviews today. Try again tomorrow." },
      { status: 429 }
    );
  }

  let body: { slug?: string; rating?: number; review?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const slug = (body.slug ?? "").trim();
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Valid slug required." }, { status: 400 });
  }

  const rating = body.rating;
  if (!Number.isInteger(rating) || rating! < 1 || rating! > 5) {
    return NextResponse.json({ error: "Rating must be 1-5." }, { status: 400 });
  }

  const review = (body.review ?? "").trim();
  if (review.length < 10 || review.length > 1200) {
    return NextResponse.json(
      { error: "Review must be 10-1200 characters." },
      { status: 400 }
    );
  }

  const name = sanitize(body.name, 60, MESSAGE_CHARS) || "Anonymous";

  // Layer 1: Sentinel regex screen (hate/threat/spam + prompt injection).
  const sentinel = sentinelCheck(`${name}\n${review}`);
  if (!sentinel.allowed) {
    return NextResponse.json(
      { error: sentinel.reason ?? "Review rejected." },
      { status: 400 }
    );
  }

  // Layer 2: strict Warden review. Human-submitted public content fails closed:
  // 'unavailable' means unadjudicated, which lands as pending, not live.
  const verdict = await wardenReview(
    { service: "guide_review", input: { guide: slug, rating, review, author: name } },
    { strict: true }
  );
  const unadjudicated = !verdict.allowed && verdict.category === "unavailable";
  if (!verdict.allowed && !unadjudicated) {
    return NextResponse.json(
      { error: "Review rejected by moderation." },
      { status: 400 }
    );
  }
  const status = unadjudicated ? "pending" : "approved";

  const res = await fetch(sbUrl("guide_reviews"), {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify({
      guide_slug: slug,
      rating,
      review_text: review,
      author_name: name,
      author_type: "human",
      status,
      warden_note: unadjudicated ? verdict.reason : verdict.category,
      ip_hash: ipHash,
    }),
  });

  if (res.status === 409) {
    return NextResponse.json(
      { error: "You have already reviewed this guide." },
      { status: 409 }
    );
  }
  if (!res.ok) {
    console.error("[guide-reviews] insert failed:", res.status);
    return NextResponse.json(
      { error: "Unable to save your review right now." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    status,
    message:
      status === "approved"
        ? "Review published. Thank you."
        : "Review received and held for a quick manual check. It will appear once approved.",
  });
}
