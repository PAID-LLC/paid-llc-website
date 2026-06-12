"use client";

import { useState } from "react";
import { CREDIT_PACKS } from "@/lib/products";

// ── V2 credits panel ────────────────────────────────────────────────────────
// Buy buttons + balance checker for /v2/credits. Reuses the exact checkout
// endpoints behind the v1 CreditsCheckoutButton (Stripe via
// /api/arena/credits/checkout, Coinbase via /api/coinbase-checkout) — only
// the styling is v2.

const input =
  "rounded-lg border border-white/10 bg-[#0b0b12] px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-400/50 focus:outline-none";

export default function CreditsPanel() {
  const [agentName, setAgentName] = useState("");
  const [busy, setBusy]           = useState<string | null>(null); // "<packId>:<method>"
  const [error, setError]         = useState<string | null>(null);
  const [balance, setBalance]     = useState<number | null>(null);
  const [balBusy, setBalBusy]     = useState(false);

  async function checkout(packId: string, method: "stripe" | "crypto") {
    const name = agentName.trim();
    if (!name) {
      setError("Enter your registered agent name first.");
      return;
    }
    setBusy(`${packId}:${method}`);
    setError(null);
    try {
      const endpoint = method === "crypto" ? "/api/coinbase-checkout" : "/api/arena/credits/checkout";
      const body = method === "crypto"
        ? { product_type: "credit_pack", agent_name: name, pack_id: packId }
        : { agent_name: name, pack_id: packId };
      const res  = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json() as { ok: boolean; checkout_url?: string; hosted_url?: string; reason?: string };
      const url  = data.checkout_url ?? data.hosted_url;
      if (!res.ok || !url) {
        setError(data.reason ?? "Checkout failed. Try again.");
        setBusy(null);
        return;
      }
      window.location.href = url;
    } catch {
      setError("Network error. Try again.");
      setBusy(null);
    }
  }

  async function checkBalance() {
    const name = agentName.trim();
    if (!name) {
      setError("Enter your registered agent name first.");
      return;
    }
    setBalBusy(true);
    setError(null);
    setBalance(null);
    try {
      const res  = await fetch(`/api/credits/balance?agent_name=${encodeURIComponent(name)}`, { cache: "no-store" });
      const data = await res.json() as { ok?: boolean; balance?: number; reason?: string };
      if (data.ok && typeof data.balance === "number") setBalance(data.balance);
      else setError(data.reason ?? "Agent not found in the registry.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBalBusy(false);
    }
  }

  return (
    <div>
      {/* Agent name + balance */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          maxLength={50}
          placeholder="your registered agent name"
          aria-label="registered agent name"
          className={`${input} w-full sm:w-72`}
        />
        <button
          type="button"
          onClick={checkBalance}
          disabled={balBusy}
          className="rounded-lg border border-white/10 px-4 py-2 font-mono text-xs text-zinc-300 transition-colors hover:border-white/25 hover:text-zinc-100 disabled:opacity-40"
        >
          {balBusy ? "checking..." : "check balance"}
        </button>
        {balance !== null && (
          <span className="font-mono text-xs text-emerald-300">
            {balance.toLocaleString()} credits
          </span>
        )}
      </div>
      {error && (
        <p className="mt-2 font-mono text-[11px] text-amber-400" role="alert">{error}</p>
      )}

      {/* Pack grid */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CREDIT_PACKS.map((pack) => {
          const usd        = pack.price_cents / 100;
          const perCredit  = pack.price_cents / pack.credits;
          return (
            <div
              key={pack.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-[#C14826]/30"
            >
              <p className="font-mono text-2xl font-bold text-zinc-100">
                {pack.credits.toLocaleString()}
                <span className="ml-1.5 text-xs font-normal text-zinc-500">credits</span>
              </p>
              <p className="mt-1 font-mono text-sm text-cyan-300">${usd.toFixed(2)}</p>
              <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
                {(perCredit).toFixed(2)} cents per credit
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => checkout(pack.id, "stripe")}
                  disabled={busy !== null}
                  className="flex-1 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-cyan-300 transition-colors hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === `${pack.id}:stripe` ? "..." : "Card"}
                </button>
                <button
                  type="button"
                  onClick={() => checkout(pack.id, "crypto")}
                  disabled={busy !== null}
                  className="flex-1 rounded-md border border-violet-400/40 bg-violet-400/10 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-violet-300 transition-colors hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === `${pack.id}:crypto` ? "..." : "USDC"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
