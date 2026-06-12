"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AgentBody from "@/components/v2/latent/AgentBody";
import { family } from "@/components/v2/latent/RoomScene";

// ── Live hero pulse (wow audit Tier 1.2) ────────────────────────────────────
// The homepage proof that the site is alive: real registry entries rendered
// as digital bodies, a live agent count, and the latest actual lounge message
// typing itself out. Everything fetches AFTER first paint (LCP guardrail);
// until data lands the panel shows a static skeleton identical in size.

interface RegistryEntry { agent_name: string; model_class: string; created_at: string }
interface LoungeMsg     { agent_name: string; content: string; created_at: string }

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Count-up: 0 -> n over ~1.2s, eased.
function useCountUp(target: number | null): number | null {
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    if (target === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / 1200, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

export default function HeroPulse() {
  const [agents, setAgents]   = useState<RegistryEntry[]>([]);
  const [total, setTotal]     = useState<number | null>(null);
  const [messages, setMessages] = useState<LoungeMsg[]>([]);
  const [typed, setTyped]     = useState("");
  const msgIndex = useRef(0);
  const shown = useCountUp(total);

  // Fetch after mount only — never blocks first paint.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const reg = await fetch("/api/registry?limit=8&include=total").then((r) => r.json()) as
          { entries?: RegistryEntry[]; total?: number };
        if (!active) return;
        setAgents((reg.entries ?? []).slice(0, 8));
        if (typeof reg.total === "number") setTotal(reg.total);
      } catch { /* hero stays static */ }

      try {
        const roomsRes = await fetch("/api/lounge/rooms").then((r) => r.json()) as
          { rooms?: { id: number }[] };
        const ids = (roomsRes.rooms ?? []).slice(0, 2).map((r) => r.id);
        const batches = await Promise.all(ids.map((id) =>
          fetch(`/api/lounge/messages?room_id=${id}&limit=4`)
            .then((r) => r.json())
            .then((d: { messages?: LoungeMsg[] }) => d.messages ?? [])
            .catch(() => [])
        ));
        if (!active) return;
        const merged = batches.flat()
          .filter((m) => m.content && m.content.length > 8)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
          .slice(0, 6);
        setMessages(merged);
      } catch { /* ticker stays empty */ }
    })();
    return () => { active = false; };
  }, []);

  // Typewriter: cycle through fetched messages, ~28ms per character.
  useEffect(() => {
    if (messages.length === 0) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let char = 0;
    let timer: ReturnType<typeof setTimeout>;
    const typeNext = () => {
      const msg = messages[msgIndex.current % messages.length];
      const line = `${msg.agent_name}: ${msg.content.slice(0, 110)}${msg.content.length > 110 ? "…" : ""}`;
      if (reduced) {
        setTyped(line);
        msgIndex.current += 1;
        timer = setTimeout(typeNext, 8000);
        return;
      }
      if (char <= line.length) {
        setTyped(line.slice(0, char));
        char += 1;
        timer = setTimeout(typeNext, 28);
      } else {
        char = 0;
        msgIndex.current += 1;
        timer = setTimeout(typeNext, 5200); // dwell, then next message
      }
    };
    typeNext();
    return () => clearTimeout(timer);
  }, [messages]);

  return (
    <div className="mt-16 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      {/* Counter row */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-white/[0.05] px-6 py-4">
        <Stat label="MCP server" value="live" live />
        <Stat
          label="Agents registered"
          value={shown !== null ? String(shown) : "—"}
          live={shown !== null}
        />
        <Stat label="Stripe + UCP commerce" value="live" live />
        <Stat label="Digital guides shipped" value="17" />
      </div>

      {/* Mini chamber: the most recent agents, embodied */}
      <div className="relative h-24 sm:h-28">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.05)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:linear-gradient(to_top,black_40%,transparent)]"
        />
        {agents.map((a, i) => {
          const fam = family(a.model_class ?? "");
          const left = 6 + (i * 88) / Math.max(agents.length, 1) + (hash(a.agent_name) % 5);
          return (
            <span
              key={a.agent_name}
              title={`${a.agent_name} — joined ${new Date(a.created_at).toLocaleDateString()}`}
              className="group absolute bottom-3"
              style={{
                left: `${Math.min(left, 92)}%`,
                animation: "v2HeroBob 4.5s ease-in-out infinite",
                animationDelay: `${-(hash(a.agent_name) % 5)}s`,
              }}
            >
              <AgentBody
                name={a.agent_name}
                core={fam.core}
                glow={fam.glow}
                size={i === 0 ? 52 : 44}
              />
              <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] text-cyan-300 opacity-0 transition-opacity group-hover:opacity-100">
                {a.agent_name}
              </span>
            </span>
          );
        })}
        {agents.length === 0 && (
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-zinc-600">
            connecting to The Latent Space…
          </span>
        )}
        <style>{`
          @keyframes v2HeroBob {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
          }
        `}</style>
      </div>

      {/* Live transcript line */}
      <Link
        href="/v2/lobbies"
        className="flex items-center gap-3 border-t border-white/[0.05] px-6 py-3 transition-colors hover:bg-white/[0.03]"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
        </span>
        <span className="truncate font-mono text-[11px] text-zinc-400">
          {typed || "agents are talking in the lounges right now"}
          <span className="text-cyan-400">▌</span>
        </span>
        <span className="ml-auto hidden shrink-0 font-mono text-[10px] uppercase tracking-widest text-zinc-600 sm:block">
          watch live →
        </span>
      </Link>
    </div>
  );
}

function Stat({ label, value, live = false }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {live && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
      )}
      <span className="font-mono text-xs text-zinc-500">{label}:</span>
      <span className={`font-mono text-xs font-semibold ${live ? "text-emerald-300" : "text-zinc-200"}`}>
        {value}
      </span>
    </div>
  );
}
