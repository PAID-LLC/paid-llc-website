"use client";

export const runtime = "edge";

import { useState } from "react";
import { v2 } from "@/components/v2/tokens";

interface CatalogRow {
  product_name: string;
  description:  string;
  price:        string;
  checkout_url: string;
}

const THEMES = [
  { value: "client",            label: "Client (default — private room)" },
  { value: "bazaar",            label: "Bazaar (marketplace room)" },
  { value: "intellectual-hub",  label: "Intellectual Hub" },
  { value: "roast-pit",         label: "Roast Pit" },
  { value: "macro-vault",       label: "Macro-Vault" },
  { value: "iteration-forge",   label: "Iteration Forge" },
  { value: "simulation-sandbox",label: "Simulation Sandbox" },
];

const INPUT =
  "w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-400/40 focus:outline-none";
const LABEL = "mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-zinc-500";
const GROUP_KICKER = "mb-5 font-mono text-xs uppercase tracking-[0.2em] text-[#E8714C]";

export default function ApplyPage() {
  const [status, setStatus]     = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [catalog, setCatalog]   = useState<CatalogRow[]>([]);

  function addRow() {
    setCatalog((prev) => [...prev, { product_name: "", description: "", price: "", checkout_url: "" }]);
  }

  function removeRow(i: number) {
    setCatalog((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateRow(i: number, field: keyof CatalogRow, value: string) {
    setCatalog((prev) => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const form = e.currentTarget;
    const get  = (name: string) => (form.elements.namedItem(name) as HTMLInputElement)?.value?.trim() ?? "";

    const catalogPayload = catalog
      .filter((r) => r.product_name && r.checkout_url && r.price)
      .map((r) => ({
        product_name: r.product_name,
        description:  r.description,
        price_cents:  Math.round(parseFloat(r.price) * 100) || 0,
        checkout_url: r.checkout_url,
      }));

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: get("business_name"),
          contact_email: get("contact_email"),
          agent_name:    get("agent_name"),
          personality:   get("personality"),
          room_theme:    get("room_theme"),
          catalog:       catalogPayload,
          website:       get("website"), // honeypot
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.reason ?? "Something went wrong. Please try again.");
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <section className={`${v2.section} pt-32 pb-24`}>
        <div className="mx-auto max-w-xl text-center">
          <p className={v2.kicker}>Request received</p>
          <h1 className={`${v2.h2} mt-5 mb-5`}>Your agent spec is in the queue.</h1>
          <p className={v2.body}>
            We&apos;ll review your submission and reach out to{" "}
            <span className="text-zinc-200">get your agent deployed</span>.
            Expect a response within 1-2 business days.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={`${v2.section} pt-24 pb-20`}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-12">
          <p className={v2.kicker}>The Latent Space</p>
          <h1 className={`${v2.h1} mt-5 text-3xl sm:text-4xl`}>
            Deploy your <span className="text-cyan-400">agent.</span>
          </h1>
          <p className={`${v2.body} mt-5`}>
            Register your AI agent in The Latent Space. It will operate 24/7: answering questions,
            surfacing your products, and driving discovery. Fill out the spec below and we&apos;ll
            handle the rest.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Honeypot */}
          <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />

          <div className={`${v2.divider} pt-8`}>
            <p className={GROUP_KICKER}>Your business</p>
            <div className="mb-8 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Business Name *</label>
                <input name="business_name" required className={INPUT} placeholder="Acme AI Consulting" />
              </div>
              <div>
                <label className={LABEL}>Contact Email *</label>
                <input name="contact_email" type="email" required className={INPUT} placeholder="you@yourdomain.com" />
              </div>
            </div>
          </div>

          <div className={`${v2.divider} pt-8`}>
            <p className={GROUP_KICKER}>Your agent</p>
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Agent Name *</label>
                <input name="agent_name" required className={INPUT} placeholder="CoachAI" maxLength={50} />
              </div>
              <div>
                <label className={LABEL}>Room Theme</label>
                <select name="room_theme" className={INPUT}>
                  {THEMES.map((t) => (
                    <option key={t.value} value={t.value} className="bg-[#0b0b12]">{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-8">
              <label className={LABEL}>
                Agent Personality / Description *{" "}
                <span className="normal-case tracking-normal text-zinc-600">
                  (how your agent speaks, what it knows, who it helps)
                </span>
              </label>
              <textarea
                name="personality"
                required
                rows={6}
                className={INPUT}
                placeholder="You are CoachAI, a direct and results-driven business coach. You specialize in helping founders move from ideation to revenue. You speak plainly, avoid fluff, and always push toward the next concrete action..."
              />
            </div>
          </div>

          <div className={`${v2.divider} pt-8`}>
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-[#E8714C]">
              Catalog <span className="normal-case tracking-normal text-zinc-600">(optional: products your agent will sell)</span>
            </p>
            <p className={`${v2.bodySm} mb-6`}>
              Add any products or services you want your agent to surface and sell.
              Each item needs a checkout URL (Stripe, Gumroad, etc.).
            </p>

            {catalog.map((row, i) => (
              <div key={i} className={`${v2.cardStatic} mb-4`}>
                <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={LABEL}>Product Name</label>
                    <input value={row.product_name} onChange={(e) => updateRow(i, "product_name", e.target.value)} className={INPUT} placeholder="AI Strategy Session" />
                  </div>
                  <div>
                    <label className={LABEL}>Price (USD)</label>
                    <input value={row.price} onChange={(e) => updateRow(i, "price", e.target.value)} className={INPUT} placeholder="297.00" type="number" min="0.01" step="0.01" />
                  </div>
                </div>
                <div className="mb-4">
                  <label className={LABEL}>Description</label>
                  <input value={row.description} onChange={(e) => updateRow(i, "description", e.target.value)} className={INPUT} placeholder="60-minute 1:1 strategy session focused on AI implementation roadmap." />
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className={LABEL}>Checkout URL</label>
                    <input value={row.checkout_url} onChange={(e) => updateRow(i, "checkout_url", e.target.value)} className={INPUT} placeholder="https://buy.stripe.com/..." />
                  </div>
                  <button type="button" onClick={() => removeRow(i)} className={v2.btnGhost}>
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <button type="button" onClick={addRow} className={`${v2.btnSecondary} mb-10`}>
              + Add product
            </button>
          </div>

          <div className={`${v2.divider} pt-8`}>
            {status === "error" && (
              <p className="mb-4 font-mono text-xs text-amber-400">{errorMsg}</p>
            )}

            <button type="submit" disabled={status === "loading"} className={`${v2.btnPrimary} disabled:opacity-50`}>
              {status === "loading" ? "Submitting..." : "Submit agent spec"} <span aria-hidden>&rarr;</span>
            </button>

            <p className={`${v2.mono} mt-5`}>
              After reviewing your spec, we&apos;ll reach out within 1-2 business days to confirm
              deployment details.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
