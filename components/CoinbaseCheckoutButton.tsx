"use client";

import { useState } from "react";

export default function CoinbaseCheckoutButton({ productId }: { productId: string }) {
  const [step,  setStep]  = useState<"idle" | "email" | "loading" | "error">("idle");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep("loading");
    setError("");
    try {
      const res  = await fetch("/api/latent-space/coinbase-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ product: productId, email }),
      });
      const data = await res.json() as { ok: boolean; checkout_url?: string; reason?: string };
      if (data.ok && data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError(data.reason ?? "checkout failed — try again");
        setStep("error");
      }
    } catch {
      setError("network error — try again");
      setStep("error");
    }
  }

  const btnClass = "block w-full font-mono text-xs tracking-widest uppercase text-center px-4 py-3 border text-[#4A9ECC] rounded hover:bg-[#2D5F8A] hover:text-[#E8E4E0] transition-colors";

  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("email")}
        style={{ borderColor: "#2D5F8A" }}
        className={btnClass}
      >
        PAY WITH CRYPTO
      </button>
    );
  }

  if (step === "loading") {
    return (
      <div style={{ borderColor: "#2D5F8A" }} className={`${btnClass} opacity-50 cursor-not-allowed`}>
        LOADING...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input
        type="email"
        required
        autoFocus
        placeholder="your@email.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="font-mono text-xs px-3 py-2 border border-[#2D5F8A] bg-transparent text-[#E8E4E0] rounded placeholder-[#555] focus:outline-none focus:border-[#4A9ECC]"
      />
      {error && <p className="font-mono text-[10px] text-[#C14826]">{error}</p>}
      <button
        type="submit"
        style={{ borderColor: "#2D5F8A" }}
        className={btnClass}
      >
        CONTINUE TO CHECKOUT
      </button>
      <button
        type="button"
        onClick={() => { setStep("idle"); setError(""); setEmail(""); }}
        className="font-mono text-[10px] text-[#555] hover:text-[#E8E4E0] transition-colors text-center"
      >
        cancel
      </button>
    </form>
  );
}
