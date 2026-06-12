"use client";

import { useState } from "react";
import { QUICK_WINS } from "@/lib/lead-magnet";

// ── Lead magnet capture form ─────────────────────────────────────────────────
// POSTs to /api/lead-magnet (MailerLite + leads row + delivery email), then
// reveals the full checklist inline so the value is immediate either way.

export default function CaptureForm() {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [hp,      setHp]      = useState(""); // honeypot
  const [busy,    setBusy]    = useState(false);
  const [done,    setDone]    = useState<string | null>(null);
  const [err,     setErr]     = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/lead-magnet", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, email, website: hp }),
      });
      const data = await res.json() as { ok: boolean; message?: string; reason?: string };
      if (data.ok) setDone(data.message ?? "You're in.");
      else setErr(data.reason ?? "Something went wrong, try again.");
    } catch {
      setErr("Something went wrong, try again.");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div>
        <div className="bg-ash border-l-4 border-primary p-6 mb-10">
          <p className="text-secondary font-semibold mb-1">{done}</p>
          <p className="text-stone text-sm">
            The full checklist is below. Keep the email copy for your desk.
          </p>
        </div>

        <div className="space-y-8">
          {QUICK_WINS.map((w, i) => (
            <div key={w.title}>
              <h3 className="font-display font-bold text-lg text-secondary mb-2">
                {String(i + 1).padStart(2, "0")}. {w.title}
              </h3>
              <p className="text-charcoal leading-relaxed mb-1">{w.how}</p>
              <p className="text-stone text-sm">Tools: {w.tool}</p>
            </div>
          ))}
        </div>

        <div className="bg-secondary text-white p-8 mt-12">
          <h3 className="font-display font-bold text-xl mb-3">
            Want these implemented for you instead of by you?
          </h3>
          <p className="text-white/70 leading-relaxed mb-6">
            PAID LLC sets up AI workflows for small businesses: consulting,
            implementation, and team training.
          </p>
          <a
            href="/contact"
            className="inline-block bg-primary text-white font-semibold px-6 py-3 hover:opacity-90 transition-opacity"
          >
            Book a free discovery call
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-ash p-8">
      <h3 className="font-display font-bold text-xl text-secondary mb-2">
        Get the checklist
      </h3>
      <p className="text-stone text-sm mb-6">
        Delivered to your inbox and unlocked on this page. No spam; unsubscribe
        any time.
      </p>

      <label className="block text-sm font-semibold text-secondary mb-2" htmlFor="lm-name">
        First name
      </label>
      <input
        id="lm-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-stone/30 bg-white px-4 py-3 mb-4 text-secondary focus:outline-none focus:border-primary"
        placeholder="Pat"
        autoComplete="given-name"
      />

      <label className="block text-sm font-semibold text-secondary mb-2" htmlFor="lm-email">
        Work email
      </label>
      <input
        id="lm-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border border-stone/30 bg-white px-4 py-3 mb-6 text-secondary focus:outline-none focus:border-primary"
        placeholder="pat@company.com"
        autoComplete="email"
      />

      {/* Honeypot — hidden from humans, bots fill it */}
      <input
        type="text"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        name="website"
      />

      {err && <p className="text-primary text-sm mb-4">{err}</p>}

      <button
        type="submit"
        disabled={busy || !email}
        className="w-full bg-primary text-white font-semibold py-3 hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send me the checklist"}
      </button>
    </form>
  );
}
