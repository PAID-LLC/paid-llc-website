"use client";

import { useState } from "react";

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/blog/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? "success" : "error");
      if (res.ok) setEmail("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="bg-ash rounded-xl p-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
        Stay sharp
      </p>
      <h3 className="font-display font-bold text-2xl text-secondary mb-2">
        Get the insights
      </h3>
      <p className="text-stone text-sm leading-relaxed mb-6">
        New posts on AI strategy, agentic commerce, and building in public. No
        filler.
      </p>
      {status === "success" ? (
        <p className="text-primary font-semibold text-sm">
          You&apos;re in. Watch for the next post.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="flex-1 border border-charcoal/20 rounded px-4 py-3 text-sm bg-white text-secondary placeholder:text-stone focus:outline-none focus:border-primary transition-colors"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="bg-primary text-white px-6 py-3 rounded font-semibold text-sm hover:bg-secondary transition-colors disabled:opacity-60"
          >
            {status === "loading" ? "Subscribing..." : "Subscribe"}
          </button>
        </form>
      )}
      {status === "error" && (
        <p className="text-red-500 text-xs mt-2">
          Something went wrong. Email hello@paiddev.com to subscribe.
        </p>
      )}
    </div>
  );
}
