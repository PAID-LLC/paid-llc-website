"use client";

import { useEffect, useMemo, useState } from "react";
import { v2 } from "@/components/v2/tokens";
import type { WorldEvent } from "@/lib/world";

// ── Live chronicle, chaptered ────────────────────────────────────────────────
// The append-only world_events log grouped into collapsible chapters, one per
// ballot: everything between a ballot_opened and the next enacted/rejected
// belongs to that ballot — correct by construction because the assembly runs
// one serialized ballot at a time. Grouping is recomputed from the merged
// event set on every render, so a chapter split across a page boundary heals
// itself once older pages load. The 45s /api/world/state poll keeps the newest
// events arriving; "load earlier" walks the full history through
// /api/world/chronicle (immutable cursor pages, cached at the edge).
// Type-only import from lib/world keeps server deps out of this bundle.

const POLL_MS = 45_000;
const PAGE = 100;
const STATE_EVENT_WINDOW = 30; // mirrors the events limit in getWorldData()

const EVENT_LABEL: Record<WorldEvent["kind"], { label: string; cls: string }> = {
  founding:      { label: "FOUNDING",  cls: "text-[#f9a8d4]" },
  docket:        { label: "DOCKET",    cls: "text-zinc-400" },
  ballot_opened: { label: "BALLOT",    cls: "text-cyan-300" },
  vote_cast:     { label: "VOTE",      cls: "text-indigo-300" },
  enacted:       { label: "ENACTED",   cls: "text-emerald-300" },
  rejected:      { label: "REJECTED",  cls: "text-zinc-500" },
  recess:        { label: "RECESS",    cls: "text-amber-300" },
  petition:      { label: "PETITION",  cls: "text-orange-300" },
  decay:         { label: "WEATHERING", cls: "text-orange-300/80" },
};

function detailLine(detail: Record<string, unknown>): string | null {
  const keys = Object.keys(detail);
  if (keys.length === 0) return null;
  return keys.map((k) => `${k}=${String(detail[k])}`).join(" · ");
}

function eventStamp(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function EventRow({ e }: { e: WorldEvent }) {
  return (
    <div className="grid gap-1 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
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
  );
}

// ── Chapter grouping ─────────────────────────────────────────────────────────

interface Chapter {
  opened: WorldEvent;
  body: WorldEvent[]; // vote_cast rows, oldest first
  closed: WorldEvent | null; // enacted | rejected, null while the ballot is live
}

type FeedItem = { t: "chapter"; c: Chapter } | { t: "single"; e: WorldEvent };

function buildFeed(events: WorldEvent[]): FeedItem[] {
  const asc = [...events].sort((a, b) => a.id - b.id);
  const items: FeedItem[] = [];
  let open: Chapter | null = null;
  for (const e of asc) {
    if (e.kind === "ballot_opened") {
      if (open) items.push({ t: "chapter", c: open }); // defensive — ballots are serialized
      open = { opened: e, body: [], closed: null };
    } else if (e.kind === "vote_cast" && open) {
      open.body.push(e);
    } else if ((e.kind === "enacted" || e.kind === "rejected") && open) {
      open.closed = e;
      items.push({ t: "chapter", c: open });
      open = null;
    } else {
      // founding / docket / recess / petition stand alone in place; a vote or
      // closure whose opening event sits past the loaded window renders as a
      // plain line until "load earlier" pulls its chapter together.
      items.push({ t: "single", e });
    }
  }
  if (open) items.push({ t: "chapter", c: open });
  return items.reverse(); // newest first
}

function chapterTitle(c: Chapter): string {
  const m = c.opened.summary.match(/"([^"]+)"/);
  return m?.[1] ?? c.opened.summary;
}

function chapterTally(c: Chapter): { yes: number; no: number } {
  const d = c.closed?.detail;
  if (d && typeof d.yes === "number" && typeof d.no === "number") {
    return { yes: d.yes, no: d.no };
  }
  let yes = 0, no = 0;
  for (const v of c.body) {
    const w = typeof v.detail.weight === "number" ? v.detail.weight : 1;
    if (v.detail.vote === "yes") yes += w;
    else if (v.detail.vote === "no") no += w;
  }
  return { yes, no };
}

function ChapterBlock({ c, expanded, onToggle }: { c: Chapter; expanded: boolean; onToggle: () => void }) {
  const outcome = c.closed
    ? c.closed.kind === "enacted"
      ? { label: "ENACTED", cls: "text-emerald-300" }
      : { label: "REJECTED", cls: "text-zinc-500" }
    : { label: "OPEN", cls: "text-cyan-300" };
  const { yes, no } = chapterTally(c);
  const votes = c.body.length;

  return (
    <div className="border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="grid w-full gap-1 text-left"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] text-zinc-500" aria-hidden>{expanded ? "▾" : "▸"}</span>
          <span className="text-[10px] tracking-widest text-cyan-300">BALLOT</span>
          <span className={`text-[10px] tracking-widest ${outcome.cls}`}>{outcome.label}</span>
          <span className="text-[10px] text-zinc-600">{eventStamp(c.opened.created_at)}</span>
        </div>
        <p className="text-sm leading-relaxed text-zinc-300">{chapterTitle(c)}</p>
        <p className="font-mono text-[10px] text-zinc-600">
          <span className="text-emerald-300/80">yes {yes}</span>
          {" · "}
          <span>no {no}</span>
          {" · "}
          {votes} vote{votes === 1 ? "" : "s"} on record
          {!expanded && " · expand for the roll"}
        </p>
      </button>
      {expanded && (
        <div className="mt-3 grid gap-3 border-l border-white/[0.08] pl-4">
          <EventRow e={c.opened} />
          {c.body.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
          {c.closed && <EventRow e={c.closed} />}
          {!c.closed && (
            <p className="text-[11px] text-zinc-500">Voting is open — the roll grows as ballots land.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Feed ─────────────────────────────────────────────────────────────────────

function mergeEvents(cur: WorldEvent[], add: WorldEvent[]): WorldEvent[] {
  const map = new Map<number, WorldEvent>();
  for (const e of cur) map.set(e.id, e);
  for (const e of add) map.set(e.id, e);
  return [...map.values()];
}

export default function ChronicleFeed({ initial }: { initial: WorldEvent[] }) {
  const [events, setEvents] = useState(initial);
  const [live, setLive] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [exhausted, setExhausted] = useState(initial.length < STATE_EVENT_WINDOW);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/world/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { events?: WorldEvent[] };
        if (!cancelled && data.events) setEvents((cur) => mergeEvents(cur, data.events!));
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

  const feed = useMemo(() => buildFeed(events), [events]);
  const newestChapterId = useMemo(
    () => feed.find((i): i is Extract<FeedItem, { t: "chapter" }> => i.t === "chapter")?.c.opened.id,
    [feed]
  );

  const loadEarlier = async () => {
    if (loadingOlder || events.length === 0) return;
    setLoadingOlder(true);
    try {
      const minId = Math.min(...events.map((e) => e.id));
      const res = await fetch(`/api/world/chronicle?before=${minId}&limit=${PAGE}`);
      if (res.ok) {
        const data = (await res.json()) as { events?: WorldEvent[] };
        if (data.events) {
          if (data.events.length < PAGE) setExhausted(true);
          setEvents((cur) => mergeEvents(cur, data.events!));
        }
      }
    } catch {
      // leave the button available to retry
    } finally {
      setLoadingOlder(false);
    }
  };

  return (
    <div className={`${v2.terminal} mt-10 max-w-3xl p-6`}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={v2.chipLive}>
          <span className={`${v2.dotLive} ${live ? "" : "opacity-40"}`} aria-hidden />
          streaming
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          refreshes every 45s · grouped by ballot
        </span>
      </div>
      <div className="grid gap-3">
        {feed.map((item) =>
          item.t === "chapter" ? (
            <ChapterBlock
              key={`c-${item.c.opened.id}`}
              c={item.c}
              expanded={expanded[item.c.opened.id] ?? item.c.opened.id === newestChapterId}
              onToggle={() =>
                setExpanded((cur) => ({
                  ...cur,
                  [item.c.opened.id]: !(cur[item.c.opened.id] ?? item.c.opened.id === newestChapterId),
                }))
              }
            />
          ) : (
            <EventRow key={item.e.id} e={item.e} />
          )
        )}
        {events.length === 0 && (
          <p className="text-sm text-zinc-500">The chronicle begins with the founding.</p>
        )}
      </div>
      <div className="mt-5 border-t border-white/[0.06] pt-4">
        {exhausted ? (
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            chronicle complete — this is the founding record
          </p>
        ) : (
          <button
            type="button"
            onClick={loadEarlier}
            disabled={loadingOlder}
            className="font-mono text-[11px] text-cyan-300 transition-colors hover:text-cyan-200 disabled:text-zinc-600"
          >
            {loadingOlder ? "loading earlier entries..." : "load earlier entries ↓"}
          </button>
        )}
      </div>
    </div>
  );
}
