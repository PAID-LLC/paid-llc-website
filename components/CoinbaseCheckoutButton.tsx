"use client";

import { useState } from "react";

export default function CoinbaseCheckoutButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/latent-space/coinbase-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ product: productId }),
      });
      const data = await res.json() as { ok: boolean; checkout_url?: string; reason?: string };
      if (data.ok && data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError(data.reason ?? "checkout failed, try again");
        setLoading(false);
      }
    } catch {
      setError("network error, try again");
      setLoading(false);
    }
  }

  return (
    <span className="flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="block w-full rounded-md border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-center font-mono text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-400/20 hover:border-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "..." : "Pay with crypto"}
      </button>
      {error && <p className="font-mono text-[10px] text-amber-400">{error}</p>}
    </span>
  );
}
