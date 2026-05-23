"use client";

import { useEffect, useRef } from "react";
import type { M3SLead } from "@/lib/my3sons-types";

interface Props {
  leads: M3SLead[];
  newLeadId: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day:   "numeric",
    hour:  "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const STATUS_COLOR: Record<string, string> = {
  new:       "#4ADE80",
  contacted: "#FCD34D",
  quoted:    "#93C5FD",
  closed:    "#6B7280",
};

export default function LeadFeed({ leads, newLeadId }: Props) {
  const newRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (newLeadId && newRowRef.current) {
      newRowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [newLeadId]);

  return (
    <div
      style={{
        background: "#0D0D0D",
        border: "1px solid #1F1F1F",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid #1F1F1F",
          background: "#111",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#4ADE80",
              display: "inline-block",
              boxShadow: "0 0 6px #4ADE80",
            }}
          />
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 11,
              color: "#6B6B6B",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Live Lead Feed
          </span>
        </div>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            color: "#4ADE80",
          }}
        >
          {leads.length} record{leads.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", maxHeight: 280, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#111" }}>
              {["Time", "Name", "Phone", "City", "Service", "Notes", "Status"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "6px 12px",
                    textAlign: "left",
                    color: "#4B5563",
                    fontFamily: "monospace",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    borderBottom: "1px solid #1F1F1F",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const isNew = lead.id === newLeadId;
              return (
                <tr
                  key={lead.id}
                  ref={isNew ? newRowRef : undefined}
                  style={{
                    borderBottom: "1px solid #141414",
                    background: isNew ? "rgba(74, 222, 128, 0.06)" : "transparent",
                    transition: "background 1.2s ease",
                    boxShadow: isNew ? "inset 0 0 20px rgba(74, 222, 128, 0.08)" : "none",
                  }}
                >
                  <td style={{ padding: "7px 12px", color: "#4B5563", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 11 }}>
                    {formatDate(lead.created_at)}
                  </td>
                  <td style={{ padding: "7px 12px", color: "#E5E7EB", whiteSpace: "nowrap" }}>
                    {lead.name ?? <span style={{ color: "#374151" }}>n/a</span>}
                  </td>
                  <td style={{ padding: "7px 12px", color: "#9CA3AF", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                    {lead.phone ?? <span style={{ color: "#374151" }}>n/a</span>}
                  </td>
                  <td style={{ padding: "7px 12px", color: "#9CA3AF", whiteSpace: "nowrap" }}>
                    {lead.city ?? <span style={{ color: "#374151" }}>n/a</span>}
                  </td>
                  <td style={{ padding: "7px 12px", color: "#93C5FD", whiteSpace: "nowrap" }}>
                    {lead.service_type ?? <span style={{ color: "#374151" }}>n/a</span>}
                  </td>
                  <td
                    style={{
                      padding: "7px 12px",
                      color: "#6B7280",
                      maxWidth: 220,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={lead.notes ?? ""}
                  >
                    {lead.notes ?? ""}
                  </td>
                  <td style={{ padding: "7px 12px", whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontFamily: "monospace",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: STATUS_COLOR[lead.status] ?? "#6B7280",
                        border: `1px solid ${STATUS_COLOR[lead.status] ?? "#374151"}`,
                        background: `${STATUS_COLOR[lead.status] ?? "#374151"}14`,
                      }}
                    >
                      {lead.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {leads.length === 0 && (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "#374151",
              fontFamily: "monospace",
              fontSize: 12,
            }}
          >
            No leads yet. Start a voice call to capture your first one.
          </div>
        )}
      </div>
    </div>
  );
}
