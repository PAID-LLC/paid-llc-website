"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────

interface IntakeRequest {
  id:            number;
  created_at:    string;
  business_name: string;
  contact_email: string;
  agent_name:    string;
  personality:   string;
  room_theme:    string;
  catalog:       CatalogItem[];
}

interface CatalogItem {
  product_name: string;
  description:  string;
  price_cents:  number;
  checkout_url: string;
}

interface CatalogRow {
  product_name: string;
  description:  string;
  price:        string;
  checkout_url: string;
}

interface DeployResult {
  ok:             boolean;
  agent_name?:    string;
  room_id?:       number;
  catalog_count?: number;
  message?:       string;
  arena?:         Record<string, string | number>;
  reason?:        string;
}

// ── Styles ────────────────────────────────────────────────────────────────

const S = {
  page:      { minHeight: "100vh", background: "#0A0A0A", color: "#E8E4E0", fontFamily: "monospace", padding: "40px 24px" } as React.CSSProperties,
  wrap:      { maxWidth: 900, margin: "0 auto" } as React.CSSProperties,
  label:     { display: "block", fontSize: 11, letterSpacing: "0.1em", color: "#888", marginBottom: 6, textTransform: "uppercase" as const },
  input:     { width: "100%", background: "#111", border: "1px solid #222", color: "#E8E4E0", padding: "10px 12px", fontFamily: "monospace", fontSize: 13, borderRadius: 2, boxSizing: "border-box" as const },
  textarea:  { width: "100%", background: "#111", border: "1px solid #222", color: "#E8E4E0", padding: "10px 12px", fontFamily: "monospace", fontSize: 13, borderRadius: 2, boxSizing: "border-box" as const, resize: "vertical" as const },
  select:    { width: "100%", background: "#111", border: "1px solid #222", color: "#E8E4E0", padding: "10px 12px", fontFamily: "monospace", fontSize: 13, borderRadius: 2, boxSizing: "border-box" as const },
  btn:       { background: "#C14826", color: "#fff", border: "none", padding: "10px 24px", fontFamily: "monospace", fontSize: 12, letterSpacing: "0.05em", cursor: "pointer", borderRadius: 2 } as React.CSSProperties,
  btnGhost:  { background: "transparent", color: "#C14826", border: "1px solid #C14826", padding: "6px 14px", fontFamily: "monospace", fontSize: 11, cursor: "pointer", borderRadius: 2 } as React.CSSProperties,
  btnSmall:  { background: "transparent", color: "#555", border: "1px solid #222", padding: "5px 10px", fontFamily: "monospace", fontSize: 11, cursor: "pointer", borderRadius: 2 } as React.CSSProperties,
  btnDanger: { background: "transparent", color: "#882222", border: "1px solid #441111", padding: "5px 10px", fontFamily: "monospace", fontSize: 11, cursor: "pointer", borderRadius: 2 } as React.CSSProperties,
  divider:   { borderTop: "1px solid #1A1A1A", margin: "28px 0" } as React.CSSProperties,
  card:      { background: "#111", border: "1px solid #1A1A1A", borderRadius: 2, padding: 16, marginBottom: 12 } as React.CSSProperties,
  grid2:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 } as React.CSSProperties,
  sectionHd: { fontSize: 11, letterSpacing: "0.15em", color: "#C14826", marginBottom: 16 } as React.CSSProperties,
};

const THEMES = ["client","bazaar","intellectual-hub","roast-pit","macro-vault","iteration-forge","simulation-sandbox"];

// ── Login form ────────────────────────────────────────────────────────────

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw]       = useState("");
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const res  = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    const data = await res.json();
    if (data.ok) { onSuccess(); } else { setErr("Invalid password."); setLoading(false); }
  }

  return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 320 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#C14826", marginBottom: 12 }}>PAID LLC</div>
        <div style={{ fontSize: 20, marginBottom: 28 }}>Admin</div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Password</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} style={S.input} autoFocus required />
          </div>
          {err && <div style={{ color: "#C14826", fontSize: 12, marginBottom: 12 }}>{err}</div>}
          <button type="submit" disabled={loading} style={{ ...S.btn, width: "100%", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Verifying..." : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Catalog row editor ────────────────────────────────────────────────────

function CatalogEditor({ catalog, onChange }: { catalog: CatalogRow[]; onChange: (c: CatalogRow[]) => void }) {
  function add() { onChange([...catalog, { product_name: "", description: "", price: "", checkout_url: "" }]); }
  function remove(i: number) { onChange(catalog.filter((_, idx) => idx !== i)); }
  function update(i: number, field: keyof CatalogRow, value: string) {
    onChange(catalog.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  return (
    <div>
      {catalog.map((row, i) => (
        <div key={i} style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", padding: 12, borderRadius: 2, marginBottom: 8 }}>
          <div style={S.grid2}>
            <div><label style={S.label}>Product Name</label><input value={row.product_name} onChange={(e) => update(i, "product_name", e.target.value)} style={S.input} /></div>
            <div><label style={S.label}>Price (USD)</label><input value={row.price} onChange={(e) => update(i, "price", e.target.value)} style={S.input} type="number" min="0.01" step="0.01" /></div>
          </div>
          <div style={{ marginBottom: 8 }}><label style={S.label}>Description</label><input value={row.description} onChange={(e) => update(i, "description", e.target.value)} style={S.input} /></div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}><label style={S.label}>Checkout URL</label><input value={row.checkout_url} onChange={(e) => update(i, "checkout_url", e.target.value)} style={S.input} /></div>
            <button type="button" onClick={() => remove(i)} style={S.btnSmall}>Remove</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} style={S.btnGhost}>+ Add Product</button>
    </div>
  );
}

// ── Deploy form ───────────────────────────────────────────────────────────

function DeployForm({ initial, onResult }: { initial?: Partial<IntakeRequest> & { intakeId?: number }; onResult: (r: DeployResult, intakeId?: number) => void }) {
  const [agentName,   setAgentName]   = useState(initial?.agent_name   ?? "");
  const [clientName,  setClientName]  = useState(initial?.business_name ?? "");
  const [personality, setPersonality] = useState(initial?.personality  ?? "");
  const [roomTheme,   setRoomTheme]   = useState(initial?.room_theme   ?? "client");
  const [catalog,     setCatalog]     = useState<CatalogRow[]>(
    (initial?.catalog ?? []).map((c) => ({ ...c, price: (c.price_cents / 100).toFixed(2) }))
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const catalogPayload = catalog
      .filter((r) => r.product_name && r.checkout_url && r.price)
      .map((r) => ({
        product_name: r.product_name,
        description:  r.description,
        price_cents:  Math.round(parseFloat(r.price) * 100) || 0,
        checkout_url: r.checkout_url,
      }));

    const res  = await fetch("/api/admin/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: agentName, client_name: clientName, personality, room_theme: roomTheme, catalog: catalogPayload }),
    });
    const data: DeployResult = await res.json();
    setLoading(false);
    onResult(data, initial?.intakeId);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={S.grid2}>
        <div><label style={S.label}>Agent Name *</label><input required value={agentName} onChange={(e) => setAgentName(e.target.value)} style={S.input} maxLength={50} /></div>
        <div><label style={S.label}>Client / Business Name</label><input value={clientName} onChange={(e) => setClientName(e.target.value)} style={S.input} /></div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>Room Theme</label>
        <select value={roomTheme} onChange={(e) => setRoomTheme(e.target.value)} style={S.select}>
          {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>Personality *</label>
        <textarea required rows={5} value={personality} onChange={(e) => setPersonality(e.target.value)} style={S.textarea} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ ...S.label, marginBottom: 12 }}>Catalog</label>
        <CatalogEditor catalog={catalog} onChange={setCatalog} />
      </div>
      <button type="submit" disabled={loading} style={{ ...S.btn, opacity: loading ? 0.6 : 1 }}>
        {loading ? "Deploying..." : "Deploy Agent"}
      </button>
    </form>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed,    setAuthed]    = useState<boolean | null>(null);
  const [requests,  setRequests]  = useState<IntakeRequest[]>([]);
  const [expanded,  setExpanded]  = useState<number | null>(null);
  const [prefill,   setPrefill]   = useState<(Partial<IntakeRequest> & { intakeId?: number }) | null>(null);
  const [result,    setResult]    = useState<DeployResult | null>(null);

  // ── Check session on mount ──────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/verify")
      .then((r) => r.json())
      .then((d) => setAuthed(d.ok))
      .catch(() => setAuthed(false));
  }, []);

  // ── Load intake requests ────────────────────────────────────────────────
  const loadRequests = useCallback(async () => {
    const res  = await fetch("/api/admin/intake");
    const data = await res.json();
    if (data.ok) setRequests(data.requests ?? []);
  }, []);

  useEffect(() => { if (authed) loadRequests(); }, [authed, loadRequests]);

  // ── Handlers ────────────────────────────────────────────────────────────
  async function rejectRequest(id: number) {
    await fetch("/api/admin/intake", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "rejected" }) });
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleDeployResult(res: DeployResult, intakeId?: number) {
    setResult(res);
    if (res.ok && intakeId) {
      await fetch("/api/admin/intake", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: intakeId, status: "deployed", room_id: res.room_id }) });
      setRequests((prev) => prev.filter((r) => r.id !== intakeId));
      setPrefill(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (authed === null) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", color: "#444" }}>Loading...</div>;
  if (!authed) return <LoginForm onSuccess={() => setAuthed(true)} />;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#C14826", marginBottom: 8 }}>PAID LLC</div>
            <div style={{ fontSize: 22 }}>Agent Admin</div>
          </div>
          <button onClick={logout} style={S.btnSmall}>Log out</button>
        </div>

        {/* ── Pending intake requests ── */}
        <div style={S.sectionHd}>PENDING INTAKE REQUESTS <span style={{ color: "#444" }}>({requests.length})</span></div>
        {requests.length === 0 && (
          <div style={{ color: "#444", fontSize: 13, marginBottom: 32 }}>No pending requests.</div>
        )}
        {requests.map((r) => (
          <div key={r.id} style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: expanded === r.id ? 16 : 0 }}>
              <div>
                <div style={{ fontSize: 14, marginBottom: 4 }}>{r.agent_name} <span style={{ color: "#555", fontSize: 12 }}>— {r.business_name}</span></div>
                <div style={{ fontSize: 11, color: "#555" }}>{r.contact_email} &middot; {new Date(r.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} style={S.btnSmall}>
                  {expanded === r.id ? "Collapse" : "Expand"}
                </button>
                <button onClick={() => { setPrefill({ ...r, intakeId: r.id }); setExpanded(null); document.getElementById("deploy-form")?.scrollIntoView({ behavior: "smooth" }); }} style={S.btnGhost}>
                  Pre-fill Deploy
                </button>
                <button onClick={() => rejectRequest(r.id)} style={S.btnDanger}>Reject</button>
              </div>
            </div>
            {expanded === r.id && (
              <div style={{ borderTop: "1px solid #1A1A1A", paddingTop: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={S.label}>Personality</div>
                  <div style={{ fontSize: 12, color: "#AAA", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.personality}</div>
                </div>
                {r.catalog?.length > 0 && (
                  <div>
                    <div style={S.label}>Catalog ({r.catalog.length} items)</div>
                    {r.catalog.map((c, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
                        {c.product_name} — ${(c.price_cents / 100).toFixed(2)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        <div style={S.divider} />

        {/* ── Deploy form ── */}
        <div id="deploy-form">
          <div style={S.sectionHd}>
            DEPLOY AGENT
            {prefill && <span style={{ color: "#555", fontWeight: 400, marginLeft: 8 }}>— pre-filled from {prefill.business_name}</span>}
            {prefill && <button onClick={() => setPrefill(null)} style={{ ...S.btnSmall, marginLeft: 12 }}>Clear</button>}
          </div>
          <DeployForm key={prefill?.intakeId ?? "manual"} initial={prefill ?? undefined} onResult={handleDeployResult} />
        </div>

        {/* ── Deploy result ── */}
        {result && (
          <div style={{ marginTop: 28 }}>
            <div style={S.divider} />
            <div style={{ ...S.sectionHd, color: result.ok ? "#44AA44" : "#C14826" }}>
              {result.ok ? "DEPLOYED" : "DEPLOY FAILED"}
            </div>
            <pre style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", padding: 16, fontSize: 12, color: "#AAA", overflowX: "auto", borderRadius: 2 }}>
              {JSON.stringify(result, null, 2)}
            </pre>
            <button onClick={() => setResult(null)} style={{ ...S.btnSmall, marginTop: 12 }}>Dismiss</button>
          </div>
        )}
      </div>
    </div>
  );
}
