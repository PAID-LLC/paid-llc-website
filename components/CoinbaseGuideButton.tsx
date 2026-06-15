"use client";

import { useState } from "react";

interface Props {
  productSlug: string;
  /** Full-width layout for product cards; default is inline (bundle CTAs). */
  block?: boolean;
}

export default function CoinbaseGuideButton({ productSlug, block = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  // Coinbase payment links do not collect an email, so we capture it here and
  // pass it through to delivery. First click reveals the field; second submits.
  const [open, setOpen]       = useState(false);
  const [email, setEmail]     = useState("");

  async function startCheckout() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid email — your download link is sent there.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res  = await fetch("/api/coinbase-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ product_type: "digital_guide", product_slug: productSlug, email }),
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

  if (!open) {
    return (
      <span className={block ? "flex w-full" : "inline-flex flex-col items-end gap-1"}>
        <button
          onClick={() => setOpen(true)}
          className={`border border-stone/40 text-stone px-4 py-2 rounded text-sm font-semibold hover:border-primary hover:text-primary transition-colors ${block ? "w-full" : ""}`}
        >
          Pay with USDC
        </button>
      </span>
    );
  }

  return (
    <span
      className={
        block
          ? "flex w-full flex-col gap-1.5"
          : "inline-flex flex-col items-end gap-1.5"
      }
    >
      <span className={`flex items-center gap-1 ${block ? "w-full" : ""}`}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") startCheckout(); }}
          placeholder="your email"
          autoFocus
          className={`border border-stone/40 bg-transparent text-stone px-2 py-2 rounded text-sm focus:border-primary outline-none ${block ? "flex-1 min-w-0" : "w-[150px]"}`}
        />
        <button
          onClick={startCheckout}
          disabled={loading}
          className="border border-primary bg-primary text-white px-3 py-2 rounded text-sm font-semibold hover:bg-secondary hover:border-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
        >
          {loading ? "Opening..." : "Continue to Coinbase"}
        </button>
      </span>
      <span
        className={`text-xs text-stone/60 leading-snug ${block ? "text-left" : "max-w-[280px] text-right"}`}
      >
        Opens Coinbase to pay in crypto. We email your download here.
      </span>
      {error && (
        <span className={`text-xs text-red-500 ${block ? "text-left" : "max-w-[280px] text-right"}`}>{error}</span>
      )}
    </span>
  );
}
