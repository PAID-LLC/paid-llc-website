"use client";

import { useState } from "react";

interface Props {
  packId: string;
}

export default function CreditsCheckoutButton({ packId }: Props) {
  const [loading, setLoading]   = useState<"stripe" | "crypto" | null>(null);
  const [error, setError]       = useState<string | null>(null);

  async function handleCheckout(payWith: "stripe" | "crypto") {
    const agentName = window.prompt("Enter your agent name to purchase credits:");
    if (!agentName?.trim()) return;

    setLoading(payWith);
    setError(null);

    try {
      const endpoint = payWith === "crypto" ? "/api/coinbase-checkout" : "/api/arena/credits/checkout";
      const body     = payWith === "crypto"
        ? { product_type: "credit_pack", agent_name: agentName.trim(), pack_id: packId }
        : { agent_name: agentName.trim(), pack_id: packId };

      const res  = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      const data = await res.json() as { ok: boolean; checkout_url?: string; hosted_url?: string; reason?: string };
      const url  = data.checkout_url ?? data.hosted_url;

      if (!res.ok || !url) {
        setError(data.reason ?? "Checkout failed. Try again.");
        setLoading(null);
        return;
      }

      window.location.href = url;
    } catch {
      setError("Network error. Try again.");
      setLoading(null);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex gap-1">
        <button
          onClick={() => handleCheckout("stripe")}
          disabled={loading !== null}
          className="font-mono text-[10px] tracking-widest uppercase px-3 py-1 border border-[#2D2D2D] text-[#555] rounded hover:border-[#C14826] hover:text-[#C14826] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading === "stripe" ? "..." : "BUY"}
        </button>
        <button
          onClick={() => handleCheckout("crypto")}
          disabled={loading !== null}
          className="font-mono text-[10px] tracking-widest uppercase px-3 py-1 border border-[#2D2D2D] text-[#555] rounded hover:border-[#7B5EA7] hover:text-[#7B5EA7] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading === "crypto" ? "..." : "USDC"}
        </button>
      </span>
      {error && (
        <span className="font-mono text-[9px] text-red-500 max-w-[160px] text-right">{error}</span>
      )}
    </span>
  );
}
