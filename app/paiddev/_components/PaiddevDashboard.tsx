"use client";

import { useState, useEffect, useCallback } from "react";
import type { PaiddevLead } from "@/lib/paiddev-types";

// ── Token gate ────────────────────────────────────────────────────────────────

const SESSION_KEY = "paiddev_access_token";

function getStoredToken(): string | null {
  try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; }
}
function storeToken(t: string) {
  try { sessionStorage.setItem(SESSION_KEY, t); } catch {}
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  new:        "#4ADE80",
  contacted:  "#93C5FD",
  qualified:  "#C084FC",
  closed:     "#6B7280",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      padding: "2px 8px",
      borderRadius: 4,
      background: `${STATUS_COLOR[status] ?? "#6B7280"}22`,
      color: STATUS_COLOR[status] ?? "#6B7280",
      border: `1px solid ${STATUS_COLOR[status] ?? "#6B7280"}44`,
    }}>
      {status}
    </span>
  );
}

// ── Transcript modal ──────────────────────────────────────────────────────────

function TranscriptModal({ lead, onClose }: { lead: PaiddevLead; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100, padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#111", border: "1px solid #2D2D2D", borderRadius: 12,
          padding: 28, maxWidth: 600, width: "100%", maxHeight: "70vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, color: "#E8E4E0", fontSize: 15 }}>
              {lead.name ?? "Unknown caller"}
            </div>
            <div style={{ fontSize: 11, color: "#6B6B6B", marginTop: 2 }}>
              {lead.company} {lead.phone ? `· ${lead.phone}` : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#6B6B6B", cursor: "pointer", fontSize: 18 }}
          >
            x
          </button>
        </div>
        {lead.transcript ? (
          <pre style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: 12, color: "#9CA3AF", lineHeight: 1.7,
            whiteSpace: "pre-wrap", margin: 0,
          }}>
            {lead.transcript}
          </pre>
        ) : (
          <div style={{ color: "#374151", fontSize: 13 }}>No transcript available for this call.</div>
        )}
      </div>
    </div>
  );
}

// ── Access gate ───────────────────────────────────────────────────────────────

function AccessGate({ onUnlock }: { onUnlock: (t: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/paiddev/session", {
        method: "POST",
        headers: { "x-access-token": input.trim() },
      });
      if (res.ok) {
        storeToken(input.trim());
        onUnlock(input.trim());
      } else {
        setError("Invalid access key.");
      }
    } catch {
      setError("Connection error. Try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#080808",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 380,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12, padding: "40px 32px",
      }}>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#C14826", letterSpacing: "0.18em", marginBottom: 12 }}>
          PAID LLC :: ADMIN
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#E8E4E0", margin: "0 0 8px", fontFamily: "'Montserrat', sans-serif" }}>
          Receptionist Dashboard
        </h1>
        <p style={{ fontSize: 12, color: "#6B6B6B", marginBottom: 24 }}>
          Inbound leads from the AI receptionist.
        </p>
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Access key"
            autoComplete="off"
            style={{
              width: "100%", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
              padding: "10px 12px", fontSize: 14, color: "#E8E4E0",
              fontFamily: "monospace", outline: "none", boxSizing: "border-box",
            }}
          />
          {error && <p style={{ fontSize: 12, color: "#F87171", margin: "8px 0 0" }}>{error}</p>}
          <button
            type="submit"
            disabled={checking || !input.trim()}
            style={{
              width: "100%", marginTop: 14, padding: "11px 0",
              background: checking ? "#374151" : "#C14826",
              color: "#fff", border: "none", borderRadius: 6,
              fontSize: 13, fontWeight: 600, cursor: checking ? "not-allowed" : "pointer",
            }}
          >
            {checking ? "Verifying..." : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function PaiddevDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [leads, setLeads] = useState<PaiddevLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PaiddevLead | null>(null);
  const [newLeadIds, setNewLeadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("access_token");
    const stored = getStoredToken();
    const t = urlToken ?? stored;
    if (t) {
      storeToken(t);
      if (urlToken) window.history.replaceState({}, "", window.location.pathname);
      setToken(t);
    }
    setTokenChecked(true);
  }, []);

  const fetchLeads = useCallback(async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/paiddev/lead", {
        headers: { "x-access-token": t },
      });
      const data = await res.json() as { leads: PaiddevLead[] };
      if (data.leads) {
        setLeads((prev) => {
          const prevIds = new Set(prev.map((l) => l.id));
          const incoming = data.leads;
          const fresh = incoming.filter((l) => !prevIds.has(l.id));
          if (fresh.length > 0) {
            const freshIds = new Set(fresh.map((l) => l.id));
            setNewLeadIds(freshIds);
            setTimeout(() => setNewLeadIds(new Set()), 3000);
          }
          return incoming;
        });
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token) return;
    void fetchLeads(token);
    const interval = setInterval(() => { void fetchLeads(token); }, 10000);
    return () => clearInterval(interval);
  }, [token, fetchLeads]);

  if (!tokenChecked) return null;
  if (!token) return <AccessGate onUnlock={(t) => setToken(t)} />;

  const newCount = leads.filter((l) => l.status === "new").length;

  return (
    <div style={{
      minHeight: "100vh", background: "#080808",
      padding: "32px 20px 48px",
      fontFamily: "'Inter', system-ui, sans-serif", color: "#E8E4E0",
    }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#C14826", letterSpacing: "0.18em", marginBottom: 6 }}>
              PAID LLC :: RECEPTIONIST DASHBOARD
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, fontFamily: "'Montserrat', sans-serif" }}>
              Inbound Leads
            </h1>
            <p style={{ fontSize: 12, color: "#6B6B6B", marginTop: 4 }}>
              Captured by Arti, your AI office receptionist.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {newCount > 0 && (
              <div style={{
                background: "#4ADE8022", border: "1px solid #4ADE8044",
                borderRadius: 6, padding: "6px 14px",
                fontSize: 12, color: "#4ADE80", fontWeight: 600,
              }}>
                {newCount} new
              </div>
            )}
            <button
              onClick={() => { void fetchLeads(token); }}
              disabled={loading}
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6, padding: "6px 14px",
                fontSize: 12, color: "#9CA3AF", cursor: "pointer",
              }}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total Leads", value: leads.length },
            { label: "New", value: leads.filter(l => l.status === "new").length },
            { label: "With Transcript", value: leads.filter(l => l.transcript).length },
            { label: "This Week", value: leads.filter(l => {
              const d = new Date(l.created_at);
              const now = new Date();
              return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
            }).length },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8, padding: "16px 20px",
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#E8E4E0" }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: "#6B6B6B", marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Lead table */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12, overflow: "hidden",
        }}>
          {leads.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "#374151", fontSize: 13 }}>
              {loading ? "Loading leads..." : "No leads yet. Arti is standing by."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["Time", "Name", "Company", "Phone", "Service Interest", "Timeline", "Status", ""].map((h) => (
                      <th key={h} style={{
                        padding: "12px 16px", textAlign: "left",
                        fontFamily: "monospace", fontSize: 10,
                        color: "#6B6B6B", letterSpacing: "0.1em",
                        fontWeight: 400, whiteSpace: "nowrap",
                      }}>
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const isNew = newLeadIds.has(lead.id);
                    return (
                      <tr
                        key={lead.id}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          background: isNew ? "rgba(74,222,128,0.05)" : "transparent",
                          transition: "background 0.5s",
                        }}
                      >
                        <td style={{ padding: "12px 16px", color: "#6B6B6B", fontFamily: "monospace", fontSize: 11, whiteSpace: "nowrap" }}>
                          {new Date(lead.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                          {new Date(lead.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "#E8E4E0", whiteSpace: "nowrap" }}>
                          {lead.name ?? <span style={{ color: "#374151" }}>Unknown</span>}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#9CA3AF" }}>
                          {lead.company ?? <span style={{ color: "#374151" }}>--</span>}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#9CA3AF", fontFamily: "monospace", fontSize: 12 }}>
                          {lead.phone ?? <span style={{ color: "#374151" }}>--</span>}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#9CA3AF", maxWidth: 180 }}>
                          {lead.service_interest ?? <span style={{ color: "#374151" }}>--</span>}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#9CA3AF" }}>
                          {lead.timeline ?? <span style={{ color: "#374151" }}>--</span>}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <StatusBadge status={lead.status} />
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {lead.transcript && (
                            <button
                              onClick={() => setSelectedLead(lead)}
                              style={{
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 4, padding: "4px 10px",
                                fontSize: 11, color: "#9CA3AF", cursor: "pointer",
                              }}
                            >
                              Transcript
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, textAlign: "center", fontFamily: "monospace", fontSize: 10, color: "#1F1F1F" }}>
          PAID LLC :: paiddev.com :: AUTO-REFRESHES EVERY 10 SECONDS
        </div>
      </div>

      {selectedLead && (
        <TranscriptModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
      )}
    </div>
  );
}
