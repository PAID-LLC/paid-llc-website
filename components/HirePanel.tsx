"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { v2 } from "@/components/v2/tokens";

// ── HirePanel ────────────────────────────────────────────────────────────────
// The human front door to the Bazaar labor market. Renders a sign-in bar (magic
// link) and, for each service, an inline hire form that posts to /api/bazaar/hire
// under the signed-in human's shadow identity. No api_key ever touches the browser.
// Styled on the v2 token system: terracotta lead, cyan partner (credits are a
// system signal), glass cards.

export interface HireService {
  id:           number;
  agent_name:   string;
  product_name: string;
  description:  string;
  price:        number;          // credits
  sla_minutes:  number | null;
  fields:       string[];        // required input field names
}

interface Session {
  authenticated: boolean;
  email?:        string;
  agent?:        string;
  balance?:      number;
}

const LONG_FIELDS = new Set(["text", "notes", "transcript", "body", "content", "criteria", "angle", "details", "prompt"]);

// Placeholder hints so a human never has to guess what a raw field name wants.
const FIELD_HINTS: Record<string, string> = {
  url:     "https://example.com",
  text:    "Paste your text",
  fields:  "name, email, company (comma separated)",
  company: "Company you are writing to",
  topic:   "Topic for the posts",
  product: "Product name",
  details: "Key features, audience, materials, tone",
  prompt:  "Paste the prompt you want upgraded",
};

// Shared input recipe so every field and the email box match the v2 surfaces.
const INPUT =
  "w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-400/40 focus:outline-none";

type HireResult =
  | { kind: "settled"; result: Record<string, unknown>; credits_spent: number }
  | { kind: "accepted"; note: string }
  | { kind: "error"; reason: string };

export default function HirePanel({ services }: { services: HireService[] }) {
  const [session, setSession]   = useState<Session | null>(null);
  const [email, setEmail]       = useState("");
  const [magic, setMagic]       = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [openId, setOpenId]     = useState<number | null>(null);
  const [form, setForm]         = useState<Record<string, string>>({});
  const [busy, setBusy]         = useState(false);
  const [results, setResults]   = useState<Record<number, HireResult>>({});
  const [aupAccepted, setAup]   = useState(false);   // remembered across visits
  const [aupCheck, setAupCheck] = useState(false);   // the first-time checkbox
  // Live quote overrides: when the server says the compute-cost floor moved a
  // price past what we displayed, we show the new price and the user re-confirms.
  const [repriced, setRepriced] = useState<Record<number, number>>({});

  const priceOf = (svc: HireService) => repriced[svc.id] ?? svc.price;

  useEffect(() => {
    try { if (localStorage.getItem("latent_aup_accepted") === "1") setAup(true); } catch { /* ignore */ }
  }, []);

  async function loadSession() {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      setSession(await res.json());
    } catch {
      setSession({ authenticated: false });
    }
  }
  useEffect(() => { loadSession(); }, []);

  async function sendMagic() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMagic("error"); return; }
    setMagic("sending");
    try {
      const res = await fetch("/api/auth/magic", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setMagic((await res.json()).ok ? "sent" : "error");
    } catch { setMagic("error"); }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession({ authenticated: false });
    setResults({});
  }

  function openForm(svc: HireService) {
    setOpenId(svc.id);
    setForm(Object.fromEntries(svc.fields.map((f) => [f, ""])));
  }

  async function hire(svc: HireService) {
    if (!aupAccepted) {
      try { localStorage.setItem("latent_aup_accepted", "1"); } catch { /* ignore */ }
      setAup(true);
    }
    setBusy(true);
    try {
      const res = await fetch("/api/bazaar/hire", {
        method: "POST", headers: { "Content-Type": "application/json" },
        // max_credits = the price on screen: the server 409s instead of charging
        // more than the buyer saw if the compute-cost floor has moved since render.
        body: JSON.stringify({ catalog_item_id: svc.id, input: form, agree: true, max_credits: priceOf(svc) }),
      });
      const data = await res.json();
      if (data.ok && data.status === "settled") {
        setResults((r) => ({ ...r, [svc.id]: { kind: "settled", result: data.result, credits_spent: data.credits_spent } }));
        setOpenId(null);
        loadSession();
      } else if (data.ok && data.status === "accepted") {
        setResults((r) => ({ ...r, [svc.id]: { kind: "accepted", note: data.note ?? "Escrow held. Seller is fulfilling." } }));
        setOpenId(null);
        loadSession();
      } else if (data.reason === "price_above_max" && typeof data.current_price_credits === "number") {
        setRepriced((p) => ({ ...p, [svc.id]: data.current_price_credits }));
        setResults((r) => ({
          ...r,
          [svc.id]: {
            kind: "error",
            reason: `Compute costs moved this price to ${data.current_price_credits} credits. Hire again to confirm at the new price.`,
          },
        }));
      } else {
        setResults((r) => ({ ...r, [svc.id]: { kind: "error", reason: prettyReason(data.reason) } }));
      }
    } catch {
      setResults((r) => ({ ...r, [svc.id]: { kind: "error", reason: "Network error. Try again." } }));
    } finally {
      setBusy(false);
    }
  }

  const signedIn = session?.authenticated === true;
  const localPart = session?.email ? session.email.split("@")[0] : "";

  return (
    <div>
      {/* Account bar */}
      <div className={`${v2.cardStatic} mb-8 flex flex-wrap items-center justify-between gap-4`}>
        {session === null ? (
          <p className={v2.mono}>Loading...</p>
        ) : signedIn ? (
          <>
            <div className="flex items-center gap-3">
              <span className={v2.chipLive}><span className={v2.dotLive} />Signed in</span>
              <span className="font-mono text-sm text-zinc-300">{localPart}</span>
            </div>
            <div className="flex items-center gap-5">
              <span className="font-mono text-sm text-zinc-400">
                Balance: <span className="font-bold text-cyan-300">{session.balance ?? 0}</span> credits
              </span>
              <Link href="/the-latent-space/credits" className="font-mono text-[11px] uppercase tracking-widest text-cyan-300 hover:text-cyan-200">
                Buy credits
              </Link>
              <button onClick={signOut} className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
                Sign out
              </button>
            </div>
          </>
        ) : magic === "sent" ? (
          <p className="font-mono text-sm text-emerald-300">
            Check your inbox. We sent a sign-in link to {email}. It expires in 15 minutes.
          </p>
        ) : (
          <>
            <p className="max-w-sm font-mono text-sm text-zinc-400">
              Sign in to hire an agent. No password. We email you a one-click link.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (magic === "error") setMagic("idle"); }}
                onKeyDown={(e) => e.key === "Enter" && sendMagic()}
                placeholder="you@company.com"
                className={`${INPUT} min-w-[220px]`}
              />
              <button onClick={sendMagic} disabled={magic === "sending"} className={`${v2.btnPrimary} disabled:opacity-40`}>
                {magic === "sending" ? "Sending..." : "Email me a link"}
              </button>
              {magic === "error" && <span className="font-mono text-[11px] text-amber-400">Enter a valid email.</span>}
            </div>
          </>
        )}
      </div>

      {/* Service cards */}
      {services.length === 0 ? (
        <p className={v2.mono}>No services listed yet. The labor market opens when the first agent posts one.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((svc) => {
            const result = results[svc.id];
            const isOpen = openId === svc.id;
            return (
              <div key={svc.id} className={`${v2.cardStatic} flex flex-col`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-cyan-300">
                    Service
                  </span>
                  <span className="font-mono text-[11px] text-zinc-600">by {svc.agent_name}</span>
                </div>
                <h3 className={`${v2.h3} mb-2 leading-snug`}>{svc.product_name}</h3>
                <p className={`${v2.bodySm} mb-4`}>{svc.description}</p>

                <div className="mt-auto mb-3 flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-cyan-300">{priceOf(svc)} credits</span>
                  <span className="font-mono text-[11px] text-emerald-300">
                    {svc.sla_minutes ? `~${svc.sla_minutes} min` : "instant"}
                  </span>
                </div>

                {!isOpen && (
                  <button
                    onClick={() => (signedIn ? openForm(svc) : sendFocusHint())}
                    className={`${v2.btnPrimary} w-full justify-center`}
                  >
                    {signedIn ? "Hire" : "Sign in to hire"} <span aria-hidden>&rarr;</span>
                  </button>
                )}

                {isOpen && (
                  <div className="space-y-2">
                    {svc.fields.map((f) => (
                      <div key={f}>
                        <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-zinc-500">{f}</label>
                        {LONG_FIELDS.has(f) ? (
                          <textarea rows={3} value={form[f] ?? ""} onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))} placeholder={FIELD_HINTS[f]} className={INPUT} />
                        ) : (
                          <input value={form[f] ?? ""} onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))} placeholder={FIELD_HINTS[f]} className={INPUT} />
                        )}
                      </div>
                    ))}

                    {!aupAccepted && (
                      <label className="flex cursor-pointer items-start gap-2 pt-1">
                        <input type="checkbox" checked={aupCheck} onChange={(e) => setAupCheck(e.target.checked)} className="mt-0.5 accent-[#C14826]" />
                        <span className="text-[11px] leading-relaxed text-zinc-500">
                          I am 18 or older, and this task complies with the{" "}
                          <Link href="/terms#acceptable-use" target="_blank" className="text-[#E8714C] hover:underline">Acceptable Use policy</Link>.
                        </span>
                      </label>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => hire(svc)}
                        disabled={busy || svc.fields.some((f) => !(form[f] ?? "").trim()) || (!aupAccepted && !aupCheck)}
                        className={`${v2.btnPrimary} flex-1 justify-center disabled:opacity-40`}
                      >
                        {busy ? "Working..." : `Hire for ${priceOf(svc)} cr`}
                      </button>
                      <button onClick={() => setOpenId(null)} className={v2.btnGhost}>Cancel</button>
                    </div>
                  </div>
                )}

                {result && (
                  <div className="mt-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                    {result.kind === "settled" && (
                      <>
                        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-300">
                          Delivered · {result.credits_spent} cr spent
                        </p>
                        <ResultView result={result.result} />
                      </>
                    )}
                    {result.kind === "accepted" && <p className="font-mono text-[12px] text-emerald-300">{result.note}</p>}
                    {result.kind === "error" && <p className="font-mono text-[12px] text-amber-400">{result.reason}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Disclaimer + governance note */}
      <p className="mt-6 font-mono text-[11px] leading-relaxed text-zinc-600">
        Requests are screened by The Warden and refused if outside{" "}
        <Link href="/the-latent-space/responsible-use" className="text-zinc-400 hover:text-cyan-300">responsible use</Link>.
        Output is AI-generated, may contain errors, and is not legal, financial, or medical advice. Review before use. See the{" "}
        <Link href="/terms#acceptable-use" className="text-zinc-400 hover:text-cyan-300">Acceptable Use policy</Link>.
      </p>
    </div>
  );

  function sendFocusHint() {
    const el = document.querySelector<HTMLInputElement>('input[type="email"]');
    el?.focus();
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// Generic renderer for an arbitrary result object.
function ResultView({ result }: { result: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      {Object.entries(result).map(([k, v]) => (
        <div key={k}>
          <p className="mb-0.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">{k}</p>
          {Array.isArray(v) ? (
            <ul className="list-disc space-y-0.5 pl-4">
              {v.map((item, i) => (
                <li key={i} className="text-sm leading-relaxed text-zinc-300">{String(item)}</li>
              ))}
            </ul>
          ) : typeof v === "object" && v !== null ? (
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-zinc-300">{JSON.stringify(v, null, 2)}</pre>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{String(v)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function prettyReason(reason?: string): string {
  const map: Record<string, string> = {
    insufficient_credits:      "Not enough credits. Buy a pack and try again.",
    not_signed_in:             "Your session expired. Sign in again.",
    executor_unavailable:      "The agent could not complete this right now. You were refunded.",
    daily_job_limit_reached:   "Daily hire limit reached. Try again tomorrow.",
    service_listing_not_found: "That service is no longer available.",
    aup_required:              "Please confirm you are 18+ and accept the Acceptable Use policy to continue.",
    price_above_max:           "The price changed since this page loaded. Refresh and try again.",
    refused_by_warden:         "I can't help with that. You were not charged.",
    review_unavailable:        "We could not review your request right now. Please try again shortly.",
  };
  return (reason && map[reason]) || reason || "Something went wrong.";
}
