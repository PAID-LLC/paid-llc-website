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
        setError(data.reason ?? "checkout failed — try again");
        setLoading(false);
      }
    } catch {
      setError("network error — try again");
      setLoading(false);
    }
  }

  return (
    <span className="flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        style={{ borderColor: "#2D5F8A" }}
        className="block w-full font-mono text-xs tracking-widest uppercase text-center px-4 py-3 border text-[#4A9ECC] rounded hover:bg-[#2D5F8A] hover:text-[#E8E4E0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "..." : "PAY WITH CRYPTO"}
      </button>
      {error && <p className="font-mono text-[10px] text-[#C14826]">{error}</p>}
    </span>
  );
}
