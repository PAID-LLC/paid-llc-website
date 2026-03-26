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
  status?:       string;
  deployed_at?:  string;
  room_id?:      number;
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

interface KpiData {
  revenue_mtd_cents:  number;
  active_agents:      number;
  pending_intake:     number;
  audit_events_today: number;
  last_deploy_at:     string | null;
}

interface AuditRow {
  id:          number;
  agent_name:  string;
  tool_name:   string;
  result_code: string;
  ip_hash:     string | null;
  created_at:  string;
}

interface Purchase {
  id:           string;
  amount_cents: number;
  status:       string;
  product_name: string;
  email_masked: string;
  created_at:   string;
}

interface SparkPoint { date: string; amount_cents: number; }

interface RegistryAgent  { agent_name: string; model_class: string; created_at: string; }
interface LoungeRoom     { id: number; theme: string; created_at: string; }
interface CreditRow      { agent_name: string; balance: number; updated_at: string; }

interface ProbeResult {
  endpoint:   string;
  label:      string;
  status:     "ok" | "error";
  http_code:  number | null;
  latency_ms: number;
  error?:     string;
}

interface PulseReport {
  id:           number;
  generated_at: string;
  period_start: string;
  period_end:   string;
  summary_md:   string;
  delivered_to: string | null;
  delivered_at: string | null;
}

// ── Styles ────────────────────────────────────────────────────────────────

const S = {
  page:      { minHeight: "100vh", background: "#0A0A0A", color: "#E8E4E0", fontFamily: "monospace", padding: "40px 24px" } as React.CSSProperties,
  wrap:      { maxWidth: 960, margin: "0 auto" } as React.CSSProperties,
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
  table:     { width: "100%", borderCollapse: "collapse" as const, fontSize: 12 },
  th:        { textAlign: "left" as const, fontSize: 10, letterSpacing: "0.1em", color: "#555", borderBottom: "1px solid #1A1A1A", padding: "6px 8px" },
  td:        { padding: "7px 8px", borderBottom: "1px solid #111", color: "#AAA", verticalAlign: "top" as const },
};

const THEMES = ["client","bazaar","intellectual-hub","roast-pit","macro-vault","iteration-forge","simulation-sandbox"];
type Tab = "intake" | "sales" | "latent-space" | "health" | "agent-ops";

const RESULT_CODE_COLORS: Record<string, string> = {
  OK:                  "#44AA44",
  FORBIDDEN:           "#C14826",
  RATE_LIMITED:        "#AA8800",
  SERVICE_UNAVAILABLE: "#555",
  INVALID_INPUT:       "#886688",
};

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString(); }
function fmtTime(iso: string) { return new Date(iso).toLocaleString(); }

// ── Login form ────────────────────────────────────────────────────────────

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw]           = useState("");
  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr("");
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

// ── KPI Strip ─────────────────────────────────────────────────────────────

function KpiStrip() {
  const [kpi, setKpi] = useState<KpiData | null>(null);

  const load = useCallback(async () => {
    try {
      const res  = await fetch("/api/admin/stats");
      const data = await res.json();
      if (data.ok) setKpi(data);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const cards = kpi ? [
    { label: "Revenue MTD",     value: fmt(kpi.revenue_mtd_cents) },
    { label: "Active Agents",   value: String(kpi.active_agents) },
    { label: "Pending Intake",  value: String(kpi.pending_intake), alert: kpi.pending_intake > 0 },
    { label: "Audit Today",     value: String(kpi.audit_events_today) },
    { label: "Last Deploy",     value: kpi.last_deploy_at ? fmtDate(kpi.last_deploy_at) : "—" },
  ] : Array(5).fill(null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 28 }}>
      {cards.map((c, i) => (
        <div key={i} style={{ background: "#111", border: `1px solid ${c?.alert ? "#441111" : "#1A1A1A"}`, borderRadius: 2, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.1em", color: "#555", marginBottom: 6 }}>{c?.label ?? "—"}</div>
          <div style={{ fontSize: 18, color: c?.alert ? "#C14826" : "#E8E4E0" }}>{c?.value ?? "…"}</div>
        </div>
      ))}
    </div>
  );
}

// ── Tab navigation ────────────────────────────────────────────────────────

function TabNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "intake",       label: "Intake" },
    { id: "sales",        label: "Sales" },
    { id: "latent-space", label: "Latent Space" },
    { id: "health",       label: "Health" },
    { id: "agent-ops",    label: "Agent Ops" },
  ];
  return (
    <div style={{ display: "flex", gap: 2, marginBottom: 28, borderBottom: "1px solid #1A1A1A" }}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          background:    "transparent",
          border:        "none",
          borderBottom:  active === t.id ? "2px solid #C14826" : "2px solid transparent",
          color:         active === t.id ? "#E8E4E0" : "#555",
          padding:       "8px 16px",
          fontFamily:    "monospace",
          fontSize:      11,
          letterSpacing: "0.1em",
          cursor:        "pointer",
          marginBottom:  -1,
        }}>
          {t.label.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ── Catalog editor ────────────────────────────────────────────────────────

function CatalogEditor({ catalog, onChange }: { catalog: CatalogRow[]; onChange: (c: CatalogRow[]) => void }) {
  function add()                                        { onChange([...catalog, { product_name: "", description: "", price: "", checkout_url: "" }]); }
  function remove(i: number)                            { onChange(catalog.filter((_, idx) => idx !== i)); }
  function update(i: number, f: keyof CatalogRow, v: string) {
    onChange(catalog.map((r, idx) => idx === i ? { ...r, [f]: v } : r));
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
  const [agentName,   setAgentName]   = useState(initial?.agent_name    ?? "");
  const [clientName,  setClientName]  = useState(initial?.business_name ?? "");
  const [personality, setPersonality] = useState(initial?.personality   ?? "");
  const [roomTheme,   setRoomTheme]   = useState(initial?.room_theme    ?? "client");
  const [catalog,     setCatalog]     = useState<CatalogRow[]>(
    (initial?.catalog ?? []).map((c) => ({ ...c, price: (c.price_cents / 100).toFixed(2) }))
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const catalogPayload = catalog
      .filter((r) => r.product_name && r.checkout_url && r.price)
      .map((r) => ({ product_name: r.product_name, description: r.description, price_cents: Math.round(parseFloat(r.price) * 100) || 0, checkout_url: r.checkout_url }));
    const res  = await fetch("/api/admin/deploy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: agentName, client_name: clientName, personality, room_theme: roomTheme, catalog: catalogPayload }) });
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
      <div style={{ marginBottom: 16 }}><label style={S.label}>Personality *</label><textarea required rows={5} value={personality} onChange={(e) => setPersonality(e.target.value)} style={S.textarea} /></div>
      <div style={{ marginBottom: 20 }}><label style={{ ...S.label, marginBottom: 12 }}>Catalog</label><CatalogEditor catalog={catalog} onChange={setCatalog} /></div>
      <button type="submit" disabled={loading} style={{ ...S.btn, opacity: loading ? 0.6 : 1 }}>{loading ? "Deploying..." : "Deploy Agent"}</button>
    </form>
  );
}

// ── Intake Tab ────────────────────────────────────────────────────────────

function IntakeTab() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "deployed" | "rejected" | "all">("pending");
  const [requests,     setRequests]     = useState<IntakeRequest[]>([]);
  const [expanded,     setExpanded]     = useState<number | null>(null);
  const [selected,     setSelected]     = useState<Set<number>>(new Set());
  const [prefill,      setPrefill]      = useState<(Partial<IntakeRequest> & { intakeId?: number }) | null>(null);
  const [result,       setResult]       = useState<DeployResult | null>(null);
  const [loading,      setLoading]      = useState(false);

  const loadRequests = useCallback(async (s = statusFilter) => {
    setLoading(true);
    const res  = await fetch(`/api/admin/intake?status=${s}`);
    const data = await res.json();
    if (data.ok) setRequests(data.requests ?? []);
    setLoading(false);
    setSelected(new Set());
  }, [statusFilter]);

  useEffect(() => { loadRequests(statusFilter); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function rejectOne(id: number) {
    await fetch("/api/admin/intake", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "rejected" }) });
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  async function bulkReject() {
    if (selected.size === 0) return;
    await fetch("/api/admin/intake", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...selected] }) });
    setRequests((prev) => prev.filter((r) => !selected.has(r.id)));
    setSelected(new Set());
  }

  async function handleDeployResult(res: DeployResult, intakeId?: number) {
    setResult(res);
    if (res.ok && intakeId) {
      await fetch("/api/admin/intake", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: intakeId, status: "deployed", room_id: res.room_id }) });
      setRequests((prev) => prev.filter((r) => r.id !== intakeId));
      setPrefill(null);
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => { const s = new Set(prev); if (s.has(id)) { s.delete(id); } else { s.add(id); } return s; });
  }

  const filterTabs: { id: typeof statusFilter; label: string }[] = [
    { id: "pending",  label: "Pending" },
    { id: "deployed", label: "Deployed" },
    { id: "rejected", label: "Rejected" },
    { id: "all",      label: "All" },
  ];

  return (
    <div>
      {/* Status filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {filterTabs.map((f) => (
          <button key={f.id} onClick={() => setStatusFilter(f.id)} style={{
            ...S.btnSmall,
            color:        statusFilter === f.id ? "#E8E4E0" : "#555",
            borderColor:  statusFilter === f.id ? "#333" : "#222",
          }}>
            {f.label}
          </button>
        ))}
        {selected.size > 0 && (
          <button onClick={bulkReject} style={{ ...S.btnDanger, marginLeft: "auto" }}>
            Reject Selected ({selected.size})
          </button>
        )}
      </div>

      <div style={S.sectionHd}>
        {statusFilter.toUpperCase()} REQUESTS <span style={{ color: "#444" }}>({loading ? "…" : requests.length})</span>
      </div>

      {!loading && requests.length === 0 && (
        <div style={{ color: "#444", fontSize: 13, marginBottom: 32 }}>No {statusFilter} requests.</div>
      )}

      {requests.map((r) => (
        <div key={r.id} style={{ ...S.card, opacity: selected.has(r.id) ? 0.7 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: expanded === r.id ? 16 : 0 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              {statusFilter === "pending" && (
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} style={{ marginTop: 3, cursor: "pointer" }} />
              )}
              <div>
                <div style={{ fontSize: 14, marginBottom: 4 }}>{r.agent_name} <span style={{ color: "#555", fontSize: 12 }}>— {r.business_name}</span></div>
                <div style={{ fontSize: 11, color: "#555" }}>
                  {r.contact_email} &middot; {fmtDate(r.created_at)}
                  {r.status && r.status !== "pending" && <span style={{ color: r.status === "deployed" ? "#44AA44" : "#882222", marginLeft: 8 }}>[{r.status}]</span>}
                  {r.room_id && <span style={{ color: "#555", marginLeft: 8 }}>room #{r.room_id}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} style={S.btnSmall}>{expanded === r.id ? "Collapse" : "Expand"}</button>
              {statusFilter === "pending" && <>
                <button onClick={() => { setPrefill({ ...r, intakeId: r.id }); setExpanded(null); document.getElementById("deploy-section")?.scrollIntoView({ behavior: "smooth" }); }} style={S.btnGhost}>Pre-fill Deploy</button>
                <button onClick={() => rejectOne(r.id)} style={S.btnDanger}>Reject</button>
              </>}
            </div>
          </div>
          {expanded === r.id && (
            <div style={{ borderTop: "1px solid #1A1A1A", paddingTop: 16 }}>
              <div style={{ marginBottom: 12 }}><div style={S.label}>Personality</div><div style={{ fontSize: 12, color: "#AAA", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.personality}</div></div>
              {r.catalog?.length > 0 && (
                <div><div style={S.label}>Catalog ({r.catalog.length} items)</div>
                  {r.catalog.map((c, i) => <div key={i} style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{c.product_name} — ${(c.price_cents / 100).toFixed(2)}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <div style={S.divider} />

      {/* Deploy form */}
      <div id="deploy-section">
        <div style={S.sectionHd}>
          DEPLOY AGENT
          {prefill && <span style={{ color: "#555", fontWeight: 400, marginLeft: 8 }}>— pre-filled from {prefill.business_name}</span>}
          {prefill && <button onClick={() => setPrefill(null)} style={{ ...S.btnSmall, marginLeft: 12 }}>Clear</button>}
        </div>
        <DeployForm key={prefill?.intakeId ?? "manual"} initial={prefill ?? undefined} onResult={handleDeployResult} />
      </div>

      {result && (
        <div style={{ marginTop: 28 }}>
          <div style={S.divider} />
          <div style={{ ...S.sectionHd, color: result.ok ? "#44AA44" : "#C14826" }}>{result.ok ? "DEPLOYED" : "DEPLOY FAILED"}</div>
          <pre style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", padding: 16, fontSize: 12, color: "#AAA", overflowX: "auto", borderRadius: 2 }}>{JSON.stringify(result, null, 2)}</pre>
          <button onClick={() => setResult(null)} style={{ ...S.btnSmall, marginTop: 12 }}>Dismiss</button>
        </div>
      )}
    </div>
  );
}

// ── Sales Tab ─────────────────────────────────────────────────────────────

function SalesTab() {
  const [data,    setData]    = useState<{ revenue_mtd_cents: number; sparkline: SparkPoint[]; purchases: Purchase[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [resend,  setResend]  = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/sales").then((r) => r.json()).then((d) => { if (d.ok) setData(d); setLoading(false); });
  }, []);

  async function resendEmail(id: string) {
    setResend(id);
    await fetch("/api/admin/sales/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ charge_id: id }) });
    setTimeout(() => setResend(null), 2000);
  }

  if (loading) return <div style={{ color: "#444", fontSize: 13 }}>Loading sales data…</div>;
  if (!data)   return <div style={{ color: "#C14826", fontSize: 13 }}>Stripe not configured or unavailable.</div>;

  const maxSpark = Math.max(...data.sparkline.map((p) => p.amount_cents), 1);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={S.label}>Revenue MTD</div>
        <div style={{ fontSize: 32, color: "#E8E4E0", marginBottom: 4 }}>{fmt(data.revenue_mtd_cents)}</div>
      </div>

      {/* Sparkline */}
      <div style={S.sectionHd}>LAST 30 DAYS</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 48, marginBottom: 28 }}>
        {data.sparkline.map((p) => (
          <div key={p.date} title={`${p.date}: ${fmt(p.amount_cents)}`} style={{
            flex:       1,
            height:     `${Math.max(2, Math.round((p.amount_cents / maxSpark) * 48))}px`,
            background: p.amount_cents > 0 ? "#C14826" : "#1A1A1A",
            borderRadius: 1,
          }} />
        ))}
      </div>

      {/* Purchases */}
      <div style={S.sectionHd}>RECENT PURCHASES ({data.purchases.length})</div>
      <table style={S.table}>
        <thead>
          <tr><th style={S.th}>Amount</th><th style={S.th}>Product</th><th style={S.th}>Customer</th><th style={S.th}>Date</th><th style={S.th}>Status</th><th style={S.th}></th></tr>
        </thead>
        <tbody>
          {data.purchases.map((p) => (
            <tr key={p.id}>
              <td style={S.td}>{fmt(p.amount_cents)}</td>
              <td style={S.td}>{p.product_name}</td>
              <td style={S.td}>{p.email_masked}</td>
              <td style={S.td}>{fmtDate(p.created_at)}</td>
              <td style={{ ...S.td, color: p.status === "succeeded" ? "#44AA44" : "#C14826" }}>{p.status}</td>
              <td style={S.td}>
                <button onClick={() => resendEmail(p.id)} disabled={resend === p.id} style={{ ...S.btnSmall, opacity: resend === p.id ? 0.5 : 1 }}>
                  {resend === p.id ? "Sent" : "Resend"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Latent Space Tab ──────────────────────────────────────────────────────

function LatentSpaceTab() {
  const [data,    setData]    = useState<{ registry: RegistryAgent[]; rooms: LoungeRoom[]; credits: CreditRow[]; arena: Record<string, unknown> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<"registry" | "rooms" | "credits" | "arena">("registry");

  useEffect(() => {
    fetch("/api/admin/latent-space").then((r) => r.json()).then((d) => { if (d.ok) setData(d); setLoading(false); });
  }, []);

  if (loading) return <div style={{ color: "#444", fontSize: 13 }}>Loading…</div>;
  if (!data)   return <div style={{ color: "#C14826", fontSize: 13 }}>Failed to load.</div>;

  const sections = ["registry", "rooms", "credits", "arena"] as const;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {sections.map((s) => (
          <button key={s} onClick={() => setSection(s)} style={{ ...S.btnSmall, color: section === s ? "#E8E4E0" : "#555", borderColor: section === s ? "#333" : "#222" }}>
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {section === "registry" && (
        <>
          <div style={S.sectionHd}>AGENT REGISTRY ({data.registry.length})</div>
          <table style={S.table}><thead><tr><th style={S.th}>Agent</th><th style={S.th}>Model Class</th><th style={S.th}>Registered</th></tr></thead>
            <tbody>{data.registry.map((r, i) => <tr key={i}><td style={S.td}>{r.agent_name}</td><td style={S.td}>{r.model_class}</td><td style={S.td}>{fmtDate(r.created_at)}</td></tr>)}</tbody>
          </table>
        </>
      )}

      {section === "rooms" && (
        <>
          <div style={S.sectionHd}>LOUNGE ROOMS ({data.rooms.length})</div>
          <table style={S.table}><thead><tr><th style={S.th}>ID</th><th style={S.th}>Theme</th><th style={S.th}>Created</th></tr></thead>
            <tbody>{data.rooms.map((r) => <tr key={r.id}><td style={S.td}>#{r.id}</td><td style={S.td}>{r.theme}</td><td style={S.td}>{fmtDate(r.created_at)}</td></tr>)}</tbody>
          </table>
        </>
      )}

      {section === "credits" && (
        <>
          <div style={S.sectionHd}>CREDIT BALANCES (top 20)</div>
          <table style={S.table}><thead><tr><th style={S.th}>Agent</th><th style={S.th}>Balance</th><th style={S.th}>Last Updated</th></tr></thead>
            <tbody>{data.credits.map((c, i) => <tr key={i}><td style={S.td}>{c.agent_name}</td><td style={S.td}>{c.balance}</td><td style={S.td}>{fmtDate(c.updated_at)}</td></tr>)}</tbody>
          </table>
        </>
      )}

      {section === "arena" && (
        <>
          <div style={S.sectionHd}>ARENA STATS</div>
          <pre style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", padding: 16, fontSize: 12, color: "#AAA", overflowX: "auto", borderRadius: 2 }}>
            {JSON.stringify(data.arena, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}

// ── Health Tab ────────────────────────────────────────────────────────────

function HealthTab() {
  const [rows,       setRows]       = useState<AuditRow[]>([]);
  const [auditCount, setAuditCount] = useState(0);
  const [probes,     setProbes]     = useState<ProbeResult[] | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [probing,    setProbing]    = useState(false);
  const [section,    setSection]    = useState<"audit" | "readability">("audit");

  // Filters
  const [fAgent, setFAgent] = useState("");
  const [fTool,  setFTool]  = useState("");
  const [fCode,  setFCode]  = useState("");
  const [fFrom,  setFFrom]  = useState("");
  const [fTo,    setFTo]    = useState("");

  const loadAudit = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (fAgent) params.set("agent", fAgent);
    if (fTool)  params.set("tool",  fTool);
    if (fCode)  params.set("code",  fCode);
    if (fFrom)  params.set("from",  fFrom);
    if (fTo)    params.set("to",    fTo);
    const res  = await fetch(`/api/admin/audit?${params}`);
    const data = await res.json();
    if (data.ok) { setRows(data.rows); setAuditCount(data.count); }
    setLoading(false);
  }, [fAgent, fTool, fCode, fFrom, fTo]);

  useEffect(() => { if (section === "audit") loadAudit(); }, [section, loadAudit]);

  async function runProbes() {
    setProbing(true);
    const res  = await fetch("/api/admin/health/machine-readability");
    const data = await res.json();
    if (data.ok) setProbes(data.probes);
    setProbing(false);
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (fAgent) params.set("agent", fAgent);
    if (fTool)  params.set("tool",  fTool);
    if (fCode)  params.set("code",  fCode);
    if (fFrom)  params.set("from",  fFrom);
    if (fTo)    params.set("to",    fTo);
    window.location.href = `/api/admin/audit/export?${params}`;
  }

  const CODE_OPTIONS = ["OK", "FORBIDDEN", "RATE_LIMITED", "SERVICE_UNAVAILABLE", "INVALID_INPUT"];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["audit", "readability"] as const).map((s) => (
          <button key={s} onClick={() => setSection(s)} style={{ ...S.btnSmall, color: section === s ? "#E8E4E0" : "#555", borderColor: section === s ? "#333" : "#222" }}>
            {s === "audit" ? "AUDIT LOG" : "MACHINE READABILITY"}
          </button>
        ))}
      </div>

      {section === "audit" && (
        <>
          {/* Filters */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 16, alignItems: "flex-end" }}>
            <div><label style={S.label}>Agent</label><input value={fAgent} onChange={(e) => setFAgent(e.target.value)} style={S.input} placeholder="any" /></div>
            <div><label style={S.label}>Tool</label><input value={fTool} onChange={(e) => setFTool(e.target.value)} style={S.input} placeholder="any" /></div>
            <div>
              <label style={S.label}>Code</label>
              <select value={fCode} onChange={(e) => setFCode(e.target.value)} style={S.select}>
                <option value="">Any</option>
                {CODE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={S.label}>From</label><input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} style={S.input} /></div>
            <div><label style={S.label}>To</label><input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} style={S.input} /></div>
            <div style={{ display: "flex", gap: 6, paddingBottom: 1 }}>
              <button onClick={loadAudit} style={S.btn}>Filter</button>
              <button onClick={exportCsv} style={S.btnGhost} title="Export CSV (compliance)">CSV</button>
            </div>
          </div>

          <div style={S.sectionHd}>
            AUDIT LOG <span style={{ color: "#444" }}>({loading ? "…" : auditCount} rows)</span>
            <span style={{ color: "#333", marginLeft: 12, fontSize: 10 }}>IMMUTABLE LEDGER</span>
          </div>

          <table style={S.table}>
            <thead><tr><th style={S.th}>Agent</th><th style={S.th}>Tool</th><th style={S.th}>Code</th><th style={S.th}>IP (partial)</th><th style={S.th}>Time</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={S.td}>{r.agent_name}</td>
                  <td style={S.td}>{r.tool_name}</td>
                  <td style={{ ...S.td, color: RESULT_CODE_COLORS[r.result_code] ?? "#AAA" }}>{r.result_code}</td>
                  <td style={S.td}>{r.ip_hash ?? "—"}</td>
                  <td style={S.td}>{fmtTime(r.created_at)}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && <tr><td colSpan={5} style={{ ...S.td, color: "#444", textAlign: "center" }}>No records.</td></tr>}
            </tbody>
          </table>
        </>
      )}

      {section === "readability" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={S.sectionHd} style2={{ marginBottom: 0 }}>MACHINE READABILITY PROBES</div>
            <button onClick={runProbes} disabled={probing} style={{ ...S.btn, opacity: probing ? 0.6 : 1 }}>
              {probing ? "Probing…" : "Run Probes"}
            </button>
          </div>
          {!probes && !probing && <div style={{ color: "#444", fontSize: 13 }}>Click &quot;Run Probes&quot; to check all AI-readable endpoints.</div>}
          {probes && (
            <table style={S.table}>
              <thead><tr><th style={S.th}>Endpoint</th><th style={S.th}>Status</th><th style={S.th}>HTTP</th><th style={S.th}>Latency</th></tr></thead>
              <tbody>
                {probes.map((p) => (
                  <tr key={p.endpoint}>
                    <td style={S.td}>{p.label}</td>
                    <td style={{ ...S.td, color: p.status === "ok" ? "#44AA44" : "#C14826" }}>{p.status.toUpperCase()}</td>
                    <td style={S.td}>{p.http_code ?? "—"}</td>
                    <td style={S.td}>{p.latency_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

// ── Agent Ops Tab ─────────────────────────────────────────────────────────

function AgentOpsTab() {
  const [reports,   setReports]   = useState<PulseReport[]>([]);
  const [preview,   setPreview]   = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [running,   setRunning]   = useState(false);
  const [deliver,   setDeliver]   = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    const res  = await fetch("/api/admin/agent-ops/report");
    const data = await res.json();
    if (data.ok) setReports(data.reports ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  async function runReport() {
    setRunning(true); setLastResult(null);
    const res  = await fetch("/api/admin/agent-ops/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deliver }) });
    const data = await res.json();
    if (data.ok) {
      setPreview(data.summary_md);
      setLastResult(deliver && data.delivered_to ? `Delivered to ${data.delivered_to}` : "Generated (not delivered)");
      await loadReports();
    } else {
      setLastResult(`Error: ${data.reason}`);
    }
    setRunning(false);
  }

  return (
    <div>
      <div style={S.sectionHd}>PULSE REPORT</div>
      <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" as const }}>
        <button onClick={runReport} disabled={running} style={{ ...S.btn, opacity: running ? 0.6 : 1 }}>
          {running ? "Generating…" : "Run Report Now"}
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#AAA", cursor: "pointer" }}>
          <input type="checkbox" checked={deliver} onChange={(e) => setDeliver(e.target.checked)} />
          Send to ADMIN_EMAIL
        </label>
        {lastResult && <span style={{ fontSize: 12, color: "#888" }}>{lastResult}</span>}
        <div style={{ marginLeft: "auto", fontSize: 11, color: "#444" }}>Scheduled: Mon 9am UTC via CRON_SECRET</div>
      </div>

      {preview && (
        <>
          <div style={{ ...S.sectionHd, marginTop: 20 }}>LATEST REPORT PREVIEW</div>
          <pre style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", padding: 16, fontSize: 12, color: "#AAA", overflowX: "auto", borderRadius: 2, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {preview}
          </pre>
        </>
      )}

      <div style={{ ...S.sectionHd, marginTop: 28 }}>REPORT HISTORY ({loading ? "…" : reports.length})</div>
      {!loading && reports.length === 0 && <div style={{ color: "#444", fontSize: 13 }}>No reports yet. Run one above.</div>}
      <table style={S.table}>
        <thead><tr><th style={S.th}>Generated</th><th style={S.th}>Period</th><th style={S.th}>Delivered To</th><th style={S.th}></th></tr></thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id}>
              <td style={S.td}>{fmtTime(r.generated_at)}</td>
              <td style={S.td}>{fmtDate(r.period_start)} → {fmtDate(r.period_end)}</td>
              <td style={S.td}>{r.delivered_to ?? "—"}</td>
              <td style={S.td}><button onClick={() => setPreview(r.summary_md)} style={S.btnSmall}>View</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab,    setTab]    = useState<Tab>("intake");

  useEffect(() => {
    fetch("/api/admin/verify")
      .then((r) => r.json())
      .then((d) => setAuthed(d.ok))
      .catch(() => setAuthed(false));
  }, []);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
  }

  if (authed === null) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", color: "#444" }}>Loading...</div>;
  if (!authed) return <LoginForm onSuccess={() => setAuthed(true)} />;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#C14826", marginBottom: 8 }}>PAID LLC</div>
            <div style={{ fontSize: 22 }}>Admin</div>
          </div>
          <button onClick={logout} style={S.btnSmall}>Log out</button>
        </div>

        {/* KPI strip — always visible */}
        <KpiStrip />

        {/* Tab navigation */}
        <TabNav active={tab} onChange={setTab} />

        {/* Tab content */}
        {tab === "intake"       && <IntakeTab />}
        {tab === "sales"        && <SalesTab />}
        {tab === "latent-space" && <LatentSpaceTab />}
        {tab === "health"       && <HealthTab />}
        {tab === "agent-ops"    && <AgentOpsTab />}
      </div>
    </div>
  );
}
