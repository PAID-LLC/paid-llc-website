"use client";

import { useState } from "react";

interface Props {
  checkoutUrl: string;
  productSlug: string | null;
}

export default function BazaarCheckoutButtons({ checkoutUrl, productSlug }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleCrypto() {
    const email = window.prompt("Enter your email address to receive your download link:");
    if (!email?.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res  = await fetch("/api/coinbase-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          product_type: "digital_guide",
          product_slug: productSlug,
          email:        email.trim(),
        }),
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
      <span className="flex gap-2">
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] tracking-widest uppercase px-4 py-2 rounded transition-colors hover:bg-[#C14826] hover:text-white"
          style={{ border: "1px solid #C14826", color: "#C14826" }}
        >
          Buy →
        </a>
        {productSlug && (
          <button
            onClick={handleCrypto}
            disabled={loading}
            className="font-mono text-[10px] tracking-widest uppercase px-4 py-2 rounded transition-colors"
            style={{
              border:  "1px solid #2D5A8E",
              color:   loading ? "#555" : "#4A8FD4",
              cursor:  loading ? "wait" : "pointer",
            }}
          >
            {loading ? "..." : "Crypto →"}
          </button>
        )}
      </span>
      {error && (
        <span className="font-mono text-[9px]" style={{ color: "#C14826" }}>
          {error}
        </span>
      )}
    </span>
  );
}
