"use client";

import { useState } from "react";

interface Props {
  productSlug: string;
}

export default function CoinbaseGuideButton({ productSlug }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleClick() {
    const email = window.prompt("Enter your email address to receive your download link:");
    if (!email?.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res  = await fetch("/api/coinbase-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ product_type: "digital_guide", product_slug: productSlug, email: email.trim() }),
      });

      const data = await res.json() as { ok: boolean; hosted_url?: string; reason?: string };

      if (!res.ok || !data.hosted_url) {
        setError(data.reason ?? "Checkout failed. Try again.");
        setLoading(false);
        return;
      }

      window.location.href = data.hosted_url;
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="border border-stone/40 text-stone px-4 py-2 rounded text-sm font-semibold hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "..." : "Pay with USDC"}
      </button>
      {error && (
        <span className="text-xs text-red-500 max-w-[160px] text-right">{error}</span>
      )}
    </span>
  );
}
