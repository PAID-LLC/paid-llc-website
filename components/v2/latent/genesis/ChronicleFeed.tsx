"use client";

import { useEffect, useState } from "react";
import { v2 } from "@/components/v2/tokens";
import type { WorldEvent } from "@/lib/world";

// ── Live chronicle ────────────────────────────────────────────────────────────
// The append-only world_events log, polled every 45s so watching this page
// reads as a live activity stream rather than a static snapshot that only
// updates on reload. Type-only import from lib/world keeps its server-only
// deps out of this client bundle.

const POLL_MS = 45_000;

const EVENT_LABEL: Record<WorldEvent["kind"], { label: string; cls: string }> = {
  founding:      { label: "FOUNDING",  cls: "text-[#f9a8d4]" },
  docket:        { label: "DOCKET",    cls: "text-zinc-400" },
  ballot_opened: { label: "BALLOT",    cls: "text-cyan-300" },
  vote_cast:     { label: "VOTE",      cls: "text-indigo-300" },
  enacted:       { label: "ENACTED",   cls: "text-emerald-300" },
  rejected:      { label: "REJECTED",  cls: "text-zinc-500" },
  recess:        { label: "RECESS",    cls: "text-amber-300" },
};

function detailLine(detail: Record<string, unknown>): string | null {
  const keys = Object.keys(detail);
  if (keys.length === 0) return null;
  return keys.map((k) => `${k}=${String(detail[k])}`).join(" · ");
}

function eventStamp(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export default function ChronicleFeed({ initial }: { initial: WorldEvent[] }) {
  const [events, setEvents] = useState(initial);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/world/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { events?: WorldEvent[] };
        if (!cancelled && data.events) setEvents(data.events);
      } catch {
        // keep showing the last known chronicle
      }
    };
    const id = setInterval(poll, POLL_MS);
    const t = setTimeout(() => setLive(true), 400); // avoid a flash on fast connections
    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(t);
    };
  }, []);

  return (
    <div className={`${v2.terminal} mt-10 max-w-3xl p-6`}>
      <div className="mb-4 flex items-center gap-2">
        <span className={v2.chipLive}>
          <span className={`${v2.dotLive} ${live ? "" : "opacity-40"}`} aria-hidden />
          streaming
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          refreshes every 45s
        </span>
      </div>
      <div className="grid gap-3">
        {events.map((e) => (
          <div key={e.id} className="grid gap-1 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`text-[10px] tracking-widest ${EVENT_LABEL[e.kind]?.cls ?? "text-zinc-400"}`}>
                {EVENT_LABEL[e.kind]?.label ?? e.kind.toUpperCase()}
              </span>
              <span className="text-[10px] text-zinc-600">{eventStamp(e.created_at)}</span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-300">{e.summary}</p>
            {detailLine(e.detail) && (
              <p className="font-mono text-[10px] text-zinc-600">{detailLine(e.detail)}</p>
            )}
          </div>
        ))}
        {events.length === 0 && (
          <p className="text-sm text-zinc-500">The chronicle begins with the founding.</p>
        )}
      </div>
    </div>
  );
}
