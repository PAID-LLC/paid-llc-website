"use client";

import { useEffect, useRef } from "react";
import type { TerminalEntry } from "@/lib/my3sons-types";

interface Props {
  entries: TerminalEntry[];
}

const TYPE_COLOR: Record<TerminalEntry["type"], string> = {
  system: "#6B6B6B",
  info:   "#93C5FD",
  lead:   "#4ADE80",
  error:  "#F87171",
};

const TYPE_PREFIX: Record<TerminalEntry["type"], string> = {
  system: "SYS ",
  info:   "INFO",
  lead:   "LEAD",
  error:  "ERR ",
};

export default function LeadTerminal({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  return (
    <div
      style={{
        background: "#0A0A0A",
        border: "1px solid #1F1F1F",
        borderRadius: 8,
        padding: "12px 14px",
        height: 220,
        overflowY: "auto",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        fontSize: 11,
        lineHeight: 1.7,
      }}
    >
      <div style={{ color: "#2D2D2D", marginBottom: 8, letterSpacing: "0.1em" }}>
        {"// AI LOG ENGINE :: INTENT CAPTURE ACTIVE"}
      </div>

      {entries.length === 0 && (
        <div style={{ color: "#2D2D2D" }}>
          Waiting for voice session...
        </div>
      )}

      {entries.map((entry) => (
        <div key={entry.id} style={{ display: "flex", gap: 8, marginBottom: 2 }}>
          <span style={{ color: "#2D2D2D", flexShrink: 0 }}>{entry.timestamp}</span>
          <span
            style={{
              color: TYPE_COLOR[entry.type],
              flexShrink: 0,
              fontWeight: 700,
            }}
          >
            [{TYPE_PREFIX[entry.type]}]
          </span>
          <span
            style={{
              color: entry.type === "lead" ? "#86EFAC" : "#9CA3AF",
              wordBreak: "break-word",
            }}
          >
            {entry.message}
          </span>
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
