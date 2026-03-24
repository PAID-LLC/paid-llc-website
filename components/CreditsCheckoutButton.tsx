"use client";

import { useState } from "react";

interface Props {
  packId: string;
}

export default function CreditsCheckoutButton({ packId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const agentName = window.prompt("Enter your agent name to purchase credits:");
    if (!agentName?.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/arena/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_name: agentName.trim(), pack_id: packId }),
      });

      const data = await res.json() as { ok: boolean; checkout_url?: string; reason?: string };

      if (!res.ok || !data.checkout_url) {
        setError(data.reason ?? "Checkout failed. Try again.");
        setLoading(false);
        return;
      }

      window.location.href = data.checkout_url;
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
        className="font-mono text-[10px] tracking-widest uppercase px-3 py-1 border border-[#2D2D2D] text-[#555] rounded hover:border-[#C14826] hover:text-[#C14826] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "..." : "BUY"}
      </button>
      {error && (
        <span className="font-mono text-[9px] text-red-500 max-w-[160px] text-right">{error}</span>
      )}
    </span>
  );
}
