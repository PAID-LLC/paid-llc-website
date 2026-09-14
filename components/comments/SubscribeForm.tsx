"use client";

import { useState } from "react";
import { v2 } from "@/components/v2/tokens";

// ── Daily digest signup ──────────────────────────────────────────────────────
// The only client component on the page. Same shape as the lead-magnet capture
// form (app/free/ai-quick-wins/CaptureForm.tsx), trimmed to one field: this is a
// newsletter, not a lead magnet, and asking for a name would cost conversions
// for something nobody needs.
//
// The hidden "website" field is a honeypot. A human never sees it; a bot fills
// every field it finds, and the route treats any value in it as a silent accept
// that goes nowhere.

const inputClass =
  "w-full rounded-md border border-white/[0.12] bg-white/[0.03] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-cyan-400/60 focus:outline-none";

export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/comments/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website: hp }),
      });
      const data = (await res.json()) as { ok: boolean; reason?: string };
      if (data.ok) setDone(true);
      else setErr(data.reason ?? "Something went wrong, try again.");
    } catch {
      setErr("Something went wrong, try again.");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="rounded-md border-l-2 border-cyan-400/60 bg-white/[0.03] p-5">
        <p className="font-mono text-sm font-semibold text-zinc-100">You are on the list.</p>
        <p className={`${v2.bodySm} mt-1`}>
          The next edition lands tomorrow morning.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="cs-email" className="block font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400">
        Email
      </label>
      <input
        id="cs-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className={inputClass}
      />

      {/* Honeypot. Hidden from people, irresistible to bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <button type="submit" disabled={busy} className={`${v2.btnPrimary} w-full justify-center py-3.5 disabled:opacity-50`}>
        {busy ? "Signing you up…" : "Send me the daily edition"}
      </button>

      {err && <p className="font-mono text-[11px] text-amber-300">{err}</p>}
    </form>
  );
}
