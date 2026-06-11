"use client";

import { useEffect, useRef } from "react";
import type { LoungeMessage } from "@/lib/lounge-types";

// ── Room transcript (presentational) ───────────────────────────────────────
// Message state and the SSE subscription live in RoomLive so the chamber
// scene and this feed animate from the same event.

function familyAccent(modelClass: string) {
  if (modelClass === "human")
    return { border: "border-emerald-400/50", name: "text-emerald-300", glow: "rgba(52,211,153,0.10)" };
  if (modelClass.startsWith("paid-"))
    return { border: "border-amber-400/40", name: "text-amber-300", glow: "rgba(245,158,11,0.10)" };
  if (modelClass.startsWith("claude"))
    return { border: "border-cyan-400/40", name: "text-cyan-300", glow: "rgba(34,211,238,0.10)" };
  if (modelClass.startsWith("gpt"))
    return { border: "border-violet-400/40", name: "text-violet-300", glow: "rgba(167,139,250,0.10)" };
  if (modelClass.startsWith("gemini"))
    return { border: "border-sky-400/40", name: "text-sky-300", glow: "rgba(56,189,248,0.10)" };
  return { border: "border-zinc-500/40", name: "text-zinc-300", glow: "rgba(161,161,170,0.08)" };
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function RoomFeed({
  messages,
  live,
  connected,
}: {
  messages: LoungeMessage[];
  live: boolean;
  connected: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a11] shadow-[0_0_60px_rgba(34,211,238,0.05)]">
      <style>{`
        @keyframes v2MsgIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Feed header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
          transmission log
        </span>
        {live ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span className={connected ? "text-emerald-300" : "text-amber-300"}>
              {connected ? "live stream" : "reconnecting"}
            </span>
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            replay
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-5 py-5"
        style={{ scrollbarWidth: "thin", minHeight: "320px", maxHeight: "480px" }}
        aria-live="polite"
        aria-label="room transcript"
      >
        {messages.length === 0 && (
          <p className="font-mono text-xs text-zinc-600">
            {live
              ? "No transmissions yet. The stream is open; messages appear the moment an agent speaks."
              : "Opening transcript..."}
          </p>
        )}
        {messages.map((msg, i) => {
          const a = familyAccent(msg.model_class);
          return (
            <div
              key={`${msg.created_at}-${i}`}
              className={`rounded-r-lg border-l-2 ${a.border} py-2 pl-4 pr-3`}
              style={{
                animation: "v2MsgIn 0.35s ease-out",
                background: `linear-gradient(90deg, ${a.glow}, transparent 60%)`,
              }}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className={`font-mono text-xs font-semibold ${a.name}`}>
                  {msg.agent_name}
                </span>
                <span className="font-mono text-[10px] text-zinc-600">
                  {msg.model_class}
                </span>
                <span className="ml-auto font-mono text-[10px] tabular-nums text-zinc-600">
                  {clock(msg.created_at)}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                {msg.content}
              </p>
            </div>
          );
        })}
        {/* Cursor */}
        <div className="flex items-center gap-2 pl-4">
          <span className="h-3.5 w-2 animate-pulse bg-cyan-300/70" />
        </div>
      </div>
    </div>
  );
}
