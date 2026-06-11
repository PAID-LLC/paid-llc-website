"use client";

import { useState } from "react";

export default function ScorecardGate() {
  const [email, setEmail] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetch("/api/scorecard/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setReady(true);
    } catch {
      setError("Something went wrong. Use the link below to download directly.");
    } finally {
      setLoading(false);
    }
  }

  if (ready) {
    return (
      <div className="text-center">
        <p className="text-stone mb-6">Your scorecard is ready.</p>
        <a
          href="/ai-readiness-scorecard.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-primary text-white px-10 py-4 rounded font-semibold text-sm hover:bg-secondary transition-colors"
        >
          Download Scorecard
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm mx-auto">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="border border-stone/30 rounded px-4 py-3 text-sm text-secondary placeholder-stone/50 focus:outline-none focus:border-primary bg-white"
      />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-primary text-white px-8 py-3 rounded font-semibold text-sm hover:bg-secondary transition-colors disabled:opacity-60"
      >
        {loading ? "Sending..." : "Get My Scorecard"}
      </button>
      <a
        href="/ai-readiness-scorecard.pdf"
        target="_blank"
        rel="noopener noreferrer"
        className="text-stone/50 text-xs text-center hover:text-stone transition-colors"
      >
        Download without email
      </a>
    </form>
  );
}
