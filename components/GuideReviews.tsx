"use client";

import { useCallback, useEffect, useState } from "react";
import { v2 } from "@/components/v2/tokens";

// ── Guide reviews section ─────────────────────────────────────────────────────
// Reader reviews for the digital guides (Gemini spec item 2, 2026-07-05).
// Mounted on /digital-products below the grid. The guide list is passed in
// from the page's products array so there is exactly one source of truth.
// Submissions go through /api/guides/reviews (Sentinel + strict Warden);
// a Warden outage holds the review as pending instead of publishing it.

export interface ReviewableGuide {
  slug: string;
  title: string;
}

interface Review {
  rating: number;
  review_text: string;
  author_name: string;
  author_type: "human" | "agent";
  created_at: string;
}

function Stars({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`font-mono tracking-widest ${className}`} aria-label={`${value} out of 5`}>
      <span className="text-cyan-300">{"★".repeat(value)}</span>
      <span className="text-zinc-700">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export default function GuideReviews({ guides }: { guides: ReviewableGuide[] }) {
  const [slug, setSlug] = useState(guides[0]?.slug ?? "");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<{ count: number; avg: number | null }>({ count: 0, avg: null });
  const [loading, setLoading] = useState(false);

  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = useCallback(async (s: string) => {
    if (!s) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/guides/reviews?slug=${encodeURIComponent(s)}`);
      if (res.ok) {
        const d = (await res.json()) as { count: number; avg: number | null; reviews: Review[] };
        setReviews(d.reviews);
        setSummary({ count: d.count, avg: d.avg });
      } else {
        setReviews([]);
        setSummary({ count: 0, avg: null });
      }
    } catch {
      setReviews([]);
      setSummary({ count: 0, avg: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(slug);
  }, [slug, load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setNotice(null);
    if (rating < 1) {
      setNotice({ kind: "err", msg: "Pick a star rating first." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/guides/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, rating, review: text, name: name || undefined }),
      });
      const d = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (res.ok && d.ok) {
        setNotice({ kind: "ok", msg: d.message ?? "Review submitted." });
        setRating(0);
        setText("");
        setName("");
        load(slug);
      } else {
        setNotice({ kind: "err", msg: d.error ?? "Unable to submit review." });
      }
    } catch {
      setNotice({ kind: "err", msg: "Unable to submit review." });
    } finally {
      setSubmitting(false);
    }
  };

  const title = guides.find((g) => g.slug === slug)?.title ?? "";

  return (
    <div className={`${v2.section} ${v2.sectionPad}`}>
      <p className={v2.kicker}>Reader reviews</p>
      <h2 className={`${v2.h2} mt-4`}>What buyers are saying.</h2>

      <div className="mt-8 grid gap-8 lg:grid-cols-[3fr_2fr] lg:items-start">
        {/* Read side */}
        <div>
          <label htmlFor="review-guide" className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Guide
          </label>
          <select
            id="review-guide"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-2 w-full rounded-md border border-white/10 bg-[#0b0b12] px-3 py-2.5 font-mono text-sm text-zinc-200 focus:border-cyan-400/50 focus:outline-none"
          >
            {guides.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.title}
              </option>
            ))}
          </select>

          <div className="mt-5 flex items-center gap-4">
            {summary.avg !== null ? (
              <>
                <Stars value={Math.round(summary.avg)} />
                <span className="font-mono text-sm text-zinc-300">
                  {summary.avg} / 5 · {summary.count}{" "}
                  {summary.count === 1 ? "review" : "reviews"}
                </span>
              </>
            ) : (
              <span className="font-mono text-sm text-zinc-500">
                {loading ? "Loading…" : "No reviews yet. Be the first."}
              </span>
            )}
          </div>

          <div className="mt-6 space-y-4">
            {reviews.map((r, i) => (
              <div key={i} className={v2.cardStatic}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Stars value={r.rating} className="text-sm" />
                  <span className="font-mono text-[10px] text-zinc-600">
                    {r.author_name}
                    {r.author_type === "agent" ? " · agent" : ""} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p className={`${v2.bodySm} mt-3 whitespace-pre-wrap`}>{r.review_text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Write side */}
        <form onSubmit={submit} className={v2.cardStatic}>
          <p className={v2.h3}>Review this guide</p>
          <p className={`${v2.bodySm} mt-2`}>{title}</p>

          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Rating
          </p>
          <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onClick={() => setRating(n)}
                className={`text-2xl transition-colors ${
                  n <= rating ? "text-cyan-300" : "text-zinc-700 hover:text-zinc-500"
                }`}
              >
                ★
              </button>
            ))}
          </div>

          <label htmlFor="review-text" className="mt-5 block font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Your review
          </label>
          <textarea
            id="review-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            minLength={10}
            maxLength={1200}
            rows={4}
            required
            placeholder="What did the guide help you do?"
            className="mt-2 w-full rounded-md border border-white/10 bg-[#0b0b12] px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-400/50 focus:outline-none"
          />

          <label htmlFor="review-name" className="mt-4 block font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Name (optional)
          </label>
          <input
            id="review-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Anonymous"
            className="mt-2 w-full rounded-md border border-white/10 bg-[#0b0b12] px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-400/50 focus:outline-none"
          />

          <button
            type="submit"
            disabled={submitting}
            className={`${v2.btnPrimary} mt-6 w-full justify-center disabled:opacity-50`}
          >
            {submitting ? "Submitting…" : "Submit review"}
          </button>

          {notice && (
            <p
              role="status"
              className={`mt-4 font-mono text-xs ${
                notice.kind === "ok" ? "text-emerald-300" : "text-[#E8714C]"
              }`}
            >
              {notice.msg}
            </p>
          )}

          <p className="mt-4 font-mono text-[10px] leading-relaxed text-zinc-600">
            Reviews are screened before publishing. One review per guide per
            reader.
          </p>
        </form>
      </div>
    </div>
  );
}
