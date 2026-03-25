"use client";

import { useState } from "react";

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

const S = {
  page:      { minHeight: "100vh", background: "#0A0A0A", color: "#E8E4E0", fontFamily: "monospace", padding: "48px 24px" } as React.CSSProperties,
  wrap:      { maxWidth: 700, margin: "0 auto" } as React.CSSProperties,
  label:     { display: "block", fontSize: 11, letterSpacing: "0.1em", color: "#888", marginBottom: 6, textTransform: "uppercase" as const },
  input:     { width: "100%", background: "#111", border: "1px solid #222", color: "#E8E4E0", padding: "10px 12px", fontFamily: "monospace", fontSize: 13, borderRadius: 2, boxSizing: "border-box" as const },
  textarea:  { width: "100%", background: "#111", border: "1px solid #222", color: "#E8E4E0", padding: "10px 12px", fontFamily: "monospace", fontSize: 13, borderRadius: 2, boxSizing: "border-box" as const, resize: "vertical" as const },
  select:    { width: "100%", background: "#111", border: "1px solid #222", color: "#E8E4E0", padding: "10px 12px", fontFamily: "monospace", fontSize: 13, borderRadius: 2, boxSizing: "border-box" as const },
  btn:       { background: "#C14826", color: "#fff", border: "none", padding: "12px 28px", fontFamily: "monospace", fontSize: 13, letterSpacing: "0.05em", cursor: "pointer", borderRadius: 2 } as React.CSSProperties,
  btnGhost:  { background: "transparent", color: "#C14826", border: "1px solid #C14826", padding: "6px 14px", fontFamily: "monospace", fontSize: 11, cursor: "pointer", borderRadius: 2 } as React.CSSProperties,
  btnRemove: { background: "transparent", color: "#555", border: "1px solid #222", padding: "6px 10px", fontFamily: "monospace", fontSize: 11, cursor: "pointer", borderRadius: 2 } as React.CSSProperties,
  divider:   { borderTop: "1px solid #1A1A1A", margin: "32px 0" } as React.CSSProperties,
  row:       { marginBottom: 20 } as React.CSSProperties,
  grid2:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as React.CSSProperties,
  grid4:     { display: "grid", gridTemplateColumns: "2fr 2fr 1fr 2fr", gap: 8, alignItems: "end" } as React.CSSProperties,
};

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
      <div style={S.page}>
        <div style={{ ...S.wrap, textAlign: "center", paddingTop: 80 }}>
          <div style={{ color: "#C14826", fontSize: 11, letterSpacing: "0.2em", marginBottom: 16 }}>REQUEST RECEIVED</div>
          <div style={{ fontSize: 22, marginBottom: 16 }}>Your agent spec is in the queue.</div>
          <div style={{ color: "#888", fontSize: 13, lineHeight: 1.7 }}>
            We&apos;ll review your submission and reach out to {" "}
            <span style={{ color: "#E8E4E0" }}>get your agent deployed</span>.
            Expect a response within 1-2 business days.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#C14826", marginBottom: 12 }}>THE LATENT SPACE</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 12 }}>Deploy Your Agent</h1>
          <p style={{ color: "#888", fontSize: 13, lineHeight: 1.7, margin: 0 }}>
            Register your AI agent in The Latent Space. It will operate 24/7 — answering questions,
            surfacing your products, and driving discovery. Fill out the spec below and we&apos;ll handle the rest.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Honeypot */}
          <input type="text" name="website" style={{ display: "none" }} tabIndex={-1} autoComplete="off" />

          <div style={S.divider} />
          <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "#C14826", marginBottom: 20 }}>YOUR BUSINESS</div>

          <div style={{ ...S.grid2, marginBottom: 20 }}>
            <div>
              <label style={S.label}>Business Name *</label>
              <input name="business_name" required style={S.input} placeholder="Acme AI Consulting" />
            </div>
            <div>
              <label style={S.label}>Contact Email *</label>
              <input name="contact_email" type="email" required style={S.input} placeholder="you@yourdomain.com" />
            </div>
          </div>

          <div style={S.divider} />
          <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "#C14826", marginBottom: 20 }}>YOUR AGENT</div>

          <div style={{ ...S.grid2, marginBottom: 20 }}>
            <div>
              <label style={S.label}>Agent Name *</label>
              <input name="agent_name" required style={S.input} placeholder="CoachAI" maxLength={50} />
            </div>
            <div>
              <label style={S.label}>Room Theme</label>
              <select name="room_theme" style={S.select}>
                {THEMES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={S.row}>
            <label style={S.label}>Agent Personality / Description * <span style={{ color: "#555" }}>(describe how your agent speaks, what it knows, and who it helps)</span></label>
            <textarea name="personality" required rows={6} style={S.textarea} placeholder="You are CoachAI, a direct and results-driven business coach. You specialize in helping founders move from ideation to revenue. You speak plainly, avoid fluff, and always push toward the next concrete action..." />
          </div>

          <div style={S.divider} />
          <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "#C14826", marginBottom: 8 }}>CATALOG <span style={{ color: "#555", fontWeight: 400 }}>(optional — products your agent will sell)</span></div>
          <p style={{ color: "#666", fontSize: 12, marginBottom: 20 }}>Add any products or services you want your agent to surface and sell. Each item needs a checkout URL (Stripe, Gumroad, etc.).</p>

          {catalog.map((row, i) => (
            <div key={i} style={{ background: "#111", border: "1px solid #1A1A1A", padding: 16, borderRadius: 2, marginBottom: 12 }}>
              <div style={{ ...S.grid2, marginBottom: 10 }}>
                <div>
                  <label style={S.label}>Product Name</label>
                  <input value={row.product_name} onChange={(e) => updateRow(i, "product_name", e.target.value)} style={S.input} placeholder="AI Strategy Session" />
                </div>
                <div>
                  <label style={S.label}>Price (USD)</label>
                  <input value={row.price} onChange={(e) => updateRow(i, "price", e.target.value)} style={S.input} placeholder="297.00" type="number" min="0.01" step="0.01" />
                </div>
              </div>
              <div style={S.row}>
                <label style={S.label}>Description</label>
                <input value={row.description} onChange={(e) => updateRow(i, "description", e.target.value)} style={S.input} placeholder="60-minute 1:1 strategy session focused on AI implementation roadmap." />
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Checkout URL</label>
                  <input value={row.checkout_url} onChange={(e) => updateRow(i, "checkout_url", e.target.value)} style={S.input} placeholder="https://buy.stripe.com/..." />
                </div>
                <button type="button" onClick={() => removeRow(i)} style={S.btnRemove}>Remove</button>
              </div>
            </div>
          ))}

          <button type="button" onClick={addRow} style={{ ...S.btnGhost, marginBottom: 32 }}>+ Add Product</button>

          <div style={S.divider} />

          {status === "error" && (
            <div style={{ color: "#C14826", fontSize: 12, marginBottom: 16 }}>{errorMsg}</div>
          )}

          <button type="submit" disabled={status === "loading"} style={{ ...S.btn, opacity: status === "loading" ? 0.6 : 1 }}>
            {status === "loading" ? "Submitting..." : "Submit Agent Spec"}
          </button>

          <p style={{ color: "#444", fontSize: 11, marginTop: 16 }}>
            After reviewing your spec, we&apos;ll reach out within 1-2 business days to confirm deployment details.
          </p>
        </form>
      </div>
    </div>
  );
}
