"use client";

import { useState } from "react";
import { QUICK_WINS } from "@/lib/lead-magnet";
import { v2 } from "@/components/v2/tokens";

// ── Lead magnet capture form ─────────────────────────────────────────────────
// POSTs to /api/lead-magnet (MailerLite + leads row + delivery email), then
// reveals the full checklist inline so the value is immediate either way.

const labelClass = "block font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400 mb-2";
const inputClass =
  "w-full rounded-md border border-white/[0.12] bg-white/[0.03] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-cyan-400/60 focus:outline-none";

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
        <div className="mb-10 rounded-md border-l-2 border-cyan-400/60 bg-white/[0.03] p-6">
          <p className="mb-1 font-mono text-sm font-semibold text-zinc-100">{done}</p>
          <p className={v2.bodySm}>
            The full checklist is below. Keep the email copy for your desk.
          </p>
        </div>

        <div className="space-y-8">
          {QUICK_WINS.map((w, i) => (
            <div key={w.title}>
              <h3 className={`${v2.h3} mb-2`}>
                {String(i + 1).padStart(2, "0")}. {w.title}
              </h3>
              <p className={`${v2.body} mb-1`}>{w.how}</p>
              <p className={v2.mono}>Tools: {w.tool}</p>
            </div>
          ))}
        </div>

        <div className={`${v2.cardStatic} mt-12`}>
          <h3 className={v2.h3}>
            Want these implemented for you instead of by you?
          </h3>
          <p className={`${v2.body} mb-6 mt-3`}>
            PAID LLC sets up AI workflows for small businesses: consulting,
            implementation, and team training.
          </p>
          <a href="/contact" className={v2.btnPrimary}>
            Book a free discovery call
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`${v2.cardStatic} p-8`}>
      <h3 className={v2.h3}>Get the checklist</h3>
      <p className={`${v2.bodySm} mb-6 mt-2`}>
        Delivered to your inbox and unlocked on this page. No spam; unsubscribe
        any time.
      </p>

      <label className={labelClass} htmlFor="lm-name">
        First name
      </label>
      <input
        id="lm-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={`${inputClass} mb-4`}
        placeholder="Pat"
        autoComplete="given-name"
      />

      <label className={labelClass} htmlFor="lm-email">
        Work email
      </label>
      <input
        id="lm-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={`${inputClass} mb-6`}
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

      {err && <p className="mb-4 text-sm text-red-400">{err}</p>}

      <button
        type="submit"
        disabled={busy || !email}
        className={`${v2.btnPrimary} w-full justify-center py-3.5 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {busy ? "Sending…" : "Send me the checklist"}
      </button>
    </form>
  );
}
