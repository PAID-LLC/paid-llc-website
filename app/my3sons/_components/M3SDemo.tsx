"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import VoiceReceptionist from "./VoiceReceptionist";
import LeadTerminal from "./LeadTerminal";
import LeadFeed from "./LeadFeed";
import type { M3SLead, TerminalEntry } from "@/lib/my3sons-types";

// ── Token gate ────────────────────────────────────────────────────────────────

const SESSION_KEY = "m3s_access_token";

function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, token);
  } catch {}
}

// ── Access denied screen ──────────────────────────────────────────────────────

function AccessDenied({ onUnlock }: { onUnlock: (token: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setChecking(true);
    setError("");

    try {
      const res = await fetch("/api/my3sons/session", {
        method: "POST",
        headers: { "x-access-token": input.trim() },
      });

      if (res.ok) {
        storeToken(input.trim());
        onUnlock(input.trim());
      } else {
        setError("Invalid access key. Contact PAID LLC for access.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080808",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: "40px 32px",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              color: "#C14826",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            PAID LLC :: Partner Portal
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#E8E4E0",
              margin: 0,
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            Partner Access Required
          </h1>
          <p style={{ fontSize: 13, color: "#6B6B6B", marginTop: 8, lineHeight: 1.6 }}>
            This demo is restricted to invited partners. Enter your PAID LLC partner access key to continue.
          </p>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              color: "#6B6B6B",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 6,
              fontFamily: "monospace",
            }}
          >
            Access Key
          </label>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="paid_xxxx_xxxx"
            autoComplete="off"
            spellCheck={false}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: 14,
              color: "#E8E4E0",
              fontFamily: "monospace",
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          {error && (
            <p style={{ fontSize: 12, color: "#F87171", marginTop: 8, marginBottom: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={checking || !input.trim()}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "11px 0",
              background: checking ? "#6B6B6B" : "#C14826",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'Montserrat', sans-serif",
              cursor: checking ? "not-allowed" : "pointer",
              letterSpacing: "0.04em",
              transition: "background 0.15s",
            }}
          >
            {checking ? "Verifying..." : "Enter"}
          </button>
        </form>

        <p style={{ fontSize: 11, color: "#374151", textAlign: "center", marginTop: 24 }}>
          Contact{" "}
          <a href="mailto:travis@paiddev.com" style={{ color: "#C14826", textDecoration: "none" }}>
            travis@paiddev.com
          </a>{" "}
          to request access.
        </p>
      </div>
    </div>
  );
}

// ── Main demo shell ───────────────────────────────────────────────────────────

export default function M3SDemo() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [leads, setLeads] = useState<M3SLead[]>([]);
  const [newLeadId, setNewLeadId] = useState<string | null>(null);
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([]);
  const entryCountRef = useRef(0);

  // ── Token gate: check URL then sessionStorage ────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("access_token");
    const stored = getStoredToken();
    const token = urlToken ?? stored;

    if (token) {
      storeToken(token);
      // Strip token from URL without page reload
      if (urlToken) {
        const clean = window.location.pathname;
        window.history.replaceState({}, "", clean);
      }
      setAccessToken(token);
    }

    setTokenChecked(true);
  }, []);

  // ── Load existing leads ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;

    fetch("/api/my3sons/lead", {
      headers: { "x-access-token": accessToken },
    })
      .then((r) => r.json())
      .then((data: { leads: M3SLead[] }) => {
        if (data.leads) setLeads(data.leads);
      })
      .catch(() => {});
  }, [accessToken]);

  const handleLeadCaptured = useCallback((lead: M3SLead) => {
    setLeads((prev) => [lead, ...prev]);
    setNewLeadId(lead.id);
    setTimeout(() => setNewLeadId(null), 3000);
  }, []);

  const handleTerminalEntry = useCallback((entry: Omit<TerminalEntry, "id">) => {
    entryCountRef.current += 1;
    setTerminalEntries((prev) => [
      ...prev,
      { ...entry, id: String(entryCountRef.current) },
    ]);
  }, []);

  if (!tokenChecked) return null;

  if (!accessToken) {
    return (
      <AccessDenied
        onUnlock={(token) => setAccessToken(token)}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080808",
        padding: "32px 20px 48px",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#E8E4E0",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              color: "#C14826",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            PAID LLC :: Proof of Concept
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              margin: 0,
              fontFamily: "'Montserrat', sans-serif",
              color: "#E8E4E0",
            }}
          >
            My 3 Sons Virtual Office
          </h1>
          <p style={{ fontSize: 13, color: "#6B6B6B", marginTop: 6 }}>
            AI voice receptionist powered by Gemini Live. Speaks naturally. Captures leads automatically.
          </p>
        </div>

        {/* Top row: voice + terminal */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginBottom: 20,
          }}
          className="m3s-grid"
        >
          {/* Voice panel */}
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "28px 24px",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 10,
                color: "#6B6B6B",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              Call My 3 Sons Virtual Office
            </div>

            <VoiceReceptionist
              accessToken={accessToken}
              onLeadCaptured={handleLeadCaptured}
              onTerminalEntry={handleTerminalEntry}
            />

            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                fontSize: 11,
                color: "#374151",
                lineHeight: 1.6,
              }}
            >
              This AI receptionist answers while the crew is on the job. It takes messages, answers service questions, and captures lead details automatically.
            </div>
          </div>

          {/* Terminal panel */}
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "28px 24px",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 10,
                color: "#6B6B6B",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              AI Log Engine
            </div>
            <LeadTerminal entries={terminalEntries} />
          </div>
        </div>

        {/* Lead feed */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
            padding: "24px",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              color: "#6B6B6B",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Real-Time Lead Feed
          </div>
          <LeadFeed leads={leads} newLeadId={newLeadId} />
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 24,
            textAlign: "center",
            fontFamily: "monospace",
            fontSize: 10,
            color: "#1F1F1F",
            letterSpacing: "0.1em",
          }}
        >
          POWERED BY PAID LLC :: paiddev.com :: CONFIDENTIAL DEMO
        </div>
      </div>

      {/* Responsive grid collapse */}
      <style>{`
        @media (max-width: 640px) {
          .m3s-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
