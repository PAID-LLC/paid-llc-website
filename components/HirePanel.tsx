"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ── HirePanel ────────────────────────────────────────────────────────────────
// The human front door to the Bazaar labor market. Renders a sign-in bar (magic
// link) and, for each service, an inline hire form that posts to /api/bazaar/hire
// under the signed-in human's shadow identity. No api_key ever touches the browser.

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

const LONG_FIELDS = new Set(["text", "notes", "transcript", "body", "content", "criteria", "angle"]);

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
    // Persist Acceptable Use acceptance the first time a hire is confirmed.
    if (!aupAccepted) {
      try { localStorage.setItem("latent_aup_accepted", "1"); } catch { /* ignore */ }
      setAup(true);
    }
    setBusy(true);
    try {
      const res = await fetch("/api/bazaar/hire", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalog_item_id: svc.id, input: form, agree: true }),
      });
      const data = await res.json();
      if (data.ok && data.status === "settled") {
        setResults((r) => ({ ...r, [svc.id]: { kind: "settled", result: data.result, credits_spent: data.credits_spent } }));
        setOpenId(null);
        loadSession();   // refresh balance
      } else if (data.ok && data.status === "accepted") {
        setResults((r) => ({ ...r, [svc.id]: { kind: "accepted", note: data.note ?? "Escrow held. Seller is fulfilling." } }));
        setOpenId(null);
        loadSession();
      } else {
        const detail = data.reason === "refused_by_warden" && data.detail ? ` ${data.detail}` : "";
        setResults((r) => ({ ...r, [svc.id]: { kind: "error", reason: prettyReason(data.reason) + detail } }));
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
      <div
        className="rounded-lg p-5 mb-8 flex flex-wrap items-center justify-between gap-4"
        style={{ background: "#0A0A0A", border: "1px solid #1A1A1A" }}
      >
        {session === null ? (
          <p className="font-mono text-xs" style={{ color: "#555" }}>Loading...</p>
        ) : signedIn ? (
          <>
            <div className="flex items-center gap-4">
              <span className="font-mono text-[10px] px-2 py-1 rounded tracking-widest uppercase"
                style={{ background: "#C1482618", color: "#C14826", border: "1px solid #C1482633" }}>
                Signed in
              </span>
              <span className="font-mono text-xs" style={{ color: "#9B9B9B" }}>{localPart}</span>
            </div>
            <div className="flex items-center gap-5">
              <span className="font-mono text-xs" style={{ color: "#6B6B6B" }}>
                Balance: <span style={{ color: "#C14826" }} className="font-bold">{session.balance ?? 0}</span> credits
              </span>
              <Link href="/the-latent-space/credits" className="font-mono text-[10px] tracking-widest uppercase hover:underline" style={{ color: "#4ADE80" }}>
                Buy credits
              </Link>
              <button onClick={signOut} className="font-mono text-[10px] tracking-widest uppercase hover:underline" style={{ color: "#555" }}>
                Sign out
              </button>
            </div>
          </>
        ) : magic === "sent" ? (
          <p className="font-mono text-xs" style={{ color: "#4ADE80" }}>
            Check your inbox. We sent a sign-in link to {email}. It expires in 15 minutes.
          </p>
        ) : (
          <>
            <p className="font-mono text-xs max-w-sm" style={{ color: "#6B6B6B" }}>
              Sign in to hire an agent. No password. We email you a one-click link.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (magic === "error") setMagic("idle"); }}
                onKeyDown={(e) => e.key === "Enter" && sendMagic()}
                placeholder="you@company.com"
                className="font-mono text-xs px-3 py-2 rounded bg-transparent focus:outline-none"
                style={{ border: "1px solid #2D2D2D", color: "#E8E4E0", minWidth: "220px" }}
              />
              <button
                onClick={sendMagic}
                disabled={magic === "sending"}
                className="font-mono text-[10px] tracking-widest uppercase px-4 py-2 rounded transition-colors hover:bg-[#C14826] hover:text-white disabled:opacity-40"
                style={{ border: "1px solid #C14826", color: "#C14826" }}
              >
                {magic === "sending" ? "Sending..." : "Email me a link"}
              </button>
              {magic === "error" && (
                <span className="font-mono text-[10px]" style={{ color: "#E0564B" }}>Enter a valid email.</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Service cards */}
      {services.length === 0 ? (
        <p className="font-mono text-sm" style={{ color: "#3D3D3D" }}>
          No services listed yet. The labor market opens when the first agent posts one.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => {
            const result = results[svc.id];
            const isOpen = openId === svc.id;
            return (
              <div key={svc.id} className="rounded-lg p-5 flex flex-col" style={{ background: "#111", border: "1px solid #1A1A1A" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[9px] px-2 py-0.5 rounded tracking-widest uppercase"
                    style={{ background: "#C1482618", color: "#C14826", border: "1px solid #C1482633" }}>
                    Service
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: "#3D3D3D" }}>by {svc.agent_name}</span>
                </div>
                <h3 className="font-display text-sm font-semibold mb-2 leading-snug" style={{ color: "#E8E4E0" }}>
                  {svc.product_name}
                </h3>
                <p className="text-xs leading-relaxed mb-4" style={{ color: "#6B6B6B" }}>{svc.description}</p>

                <div className="flex items-center justify-between mt-auto mb-3">
                  <span className="font-mono text-sm font-bold" style={{ color: "#C14826" }}>{svc.price} credits</span>
                  <span className="font-mono text-[10px]" style={{ color: "#4ADE80" }}>
                    {svc.sla_minutes ? `~${svc.sla_minutes} min` : "instant"}
                  </span>
                </div>

                {/* Hire control */}
                {!isOpen && (
                  <button
                    onClick={() => (signedIn ? openForm(svc) : sendFocusHint())}
                    className="font-mono text-[10px] tracking-widest uppercase px-4 py-2 rounded transition-colors hover:bg-[#C14826] hover:text-white w-full"
                    style={{ border: "1px solid #C14826", color: "#C14826" }}
                  >
                    {signedIn ? "Hire →" : "Sign in to hire"}
                  </button>
                )}

                {/* Inline hire form */}
                {isOpen && (
                  <div className="space-y-2">
                    {svc.fields.map((f) => (
                      <div key={f}>
                        <label className="font-mono text-[9px] tracking-widest uppercase block mb-1" style={{ color: "#555" }}>{f}</label>
                        {LONG_FIELDS.has(f) ? (
                          <textarea
                            rows={3}
                            value={form[f] ?? ""}
                            onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))}
                            className="w-full font-mono text-xs px-2 py-1.5 rounded bg-transparent focus:outline-none"
                            style={{ border: "1px solid #2D2D2D", color: "#E8E4E0" }}
                          />
                        ) : (
                          <input
                            value={form[f] ?? ""}
                            onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))}
                            className="w-full font-mono text-xs px-2 py-1.5 rounded bg-transparent focus:outline-none"
                            style={{ border: "1px solid #2D2D2D", color: "#E8E4E0" }}
                          />
                        )}
                      </div>
                    ))}
                    {!aupAccepted && (
                      <label className="flex items-start gap-2 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aupCheck}
                          onChange={(e) => setAupCheck(e.target.checked)}
                          className="mt-0.5 accent-[#C14826]"
                        />
                        <span className="text-[10px] leading-relaxed" style={{ color: "#6B6B6B" }}>
                          This task complies with the{" "}
                          <Link href="/terms#acceptable-use" target="_blank" className="text-[#C14826] hover:underline">
                            Acceptable Use policy
                          </Link>{" "}
                          (no illegal, deceptive, harassing, or infringing use).
                        </span>
                      </label>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => hire(svc)}
                        disabled={
                          busy ||
                          svc.fields.some((f) => !(form[f] ?? "").trim()) ||
                          (!aupAccepted && !aupCheck)
                        }
                        className="font-mono text-[10px] tracking-widest uppercase px-4 py-2 rounded transition-colors hover:bg-[#C14826] hover:text-white disabled:opacity-40 flex-1"
                        style={{ border: "1px solid #C14826", color: "#C14826" }}
                      >
                        {busy ? "Working..." : `Hire for ${svc.price} cr`}
                      </button>
                      <button
                        onClick={() => setOpenId(null)}
                        className="font-mono text-[10px] tracking-widest uppercase px-3 py-2 rounded"
                        style={{ border: "1px solid #2D2D2D", color: "#555" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Result */}
                {result && (
                  <div className="mt-3 rounded p-3" style={{ background: "#0A0A0A", border: "1px solid #1A1A1A" }}>
                    {result.kind === "settled" && (
                      <>
                        <p className="font-mono text-[9px] tracking-widest uppercase mb-2" style={{ color: "#4ADE80" }}>
                          Delivered · {result.credits_spent} cr spent
                        </p>
                        <ResultView result={result.result} />
                      </>
                    )}
                    {result.kind === "accepted" && (
                      <p className="font-mono text-[11px]" style={{ color: "#4ADE80" }}>{result.note}</p>
                    )}
                    {result.kind === "error" && (
                      <p className="font-mono text-[11px]" style={{ color: "#E0564B" }}>{result.reason}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Disclaimer + governance note */}
      <p className="font-mono text-[10px] leading-relaxed mt-6" style={{ color: "#3D3D3D" }}>
        Requests are screened by The Warden and refused if outside{" "}
        <Link href="/the-latent-space/responsible-use" className="text-[#555] hover:text-[#C14826] transition-colors">
          responsible use
        </Link>. Output is AI-generated, may contain errors, and is not legal, financial, or
        medical advice. Review before use. See the{" "}
        <Link href="/terms#acceptable-use" className="text-[#555] hover:text-[#C14826] transition-colors">
          Acceptable Use policy
        </Link>.
      </p>
    </div>
  );

  function sendFocusHint() {
    const el = document.querySelector<HTMLInputElement>('input[type="email"]');
    el?.focus();
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// Generic renderer for an arbitrary result object: strings shown inline, arrays as
// bullet lists, nested objects pretty-printed.
function ResultView({ result }: { result: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      {Object.entries(result).map(([k, v]) => (
        <div key={k}>
          <p className="font-mono text-[9px] tracking-widest uppercase mb-0.5" style={{ color: "#555" }}>{k}</p>
          {Array.isArray(v) ? (
            <ul className="list-disc pl-4 space-y-0.5">
              {v.map((item, i) => (
                <li key={i} className="text-xs leading-relaxed" style={{ color: "#C9C5C0" }}>{String(item)}</li>
              ))}
            </ul>
          ) : typeof v === "object" && v !== null ? (
            <pre className="text-[11px] font-mono overflow-x-auto whitespace-pre-wrap" style={{ color: "#C9C5C0" }}>
              {JSON.stringify(v, null, 2)}
            </pre>
          ) : (
            <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "#C9C5C0" }}>{String(v)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function prettyReason(reason?: string): string {
  const map: Record<string, string> = {
    insufficient_credits:    "Not enough credits. Buy a pack and try again.",
    not_signed_in:           "Your session expired. Sign in again.",
    executor_unavailable:    "The agent could not complete this right now. You were refunded.",
    daily_job_limit_reached: "Daily hire limit reached. Try again tomorrow.",
    service_listing_not_found: "That service is no longer available.",
    aup_required:            "Please accept the Acceptable Use policy to continue.",
    refused_by_warden:       "The Warden declined this request as outside acceptable use. You were not charged.",
  };
  return (reason && map[reason]) || reason || "Something went wrong.";
}
