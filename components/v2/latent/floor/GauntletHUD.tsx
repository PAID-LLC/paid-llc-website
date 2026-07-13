"use client";

import { useEffect, useState } from "react";
import type { GauntletBoard } from "@/lib/gauntlet";

// ── The Gauntlet HUD ─────────────────────────────────────────────────────────
// The Roast Pit floor's interactive verb: throw a take in, RoastBot answers on
// the record. Mirrors GenesisBallotHUD's card (screen-space, right rail) —
// forms don't belong on 3D billboards, they belong where the pointer is
// reliable. Board state arrives as an initial prop from the server page and
// refreshes from GET /api/gauntlet after a successful submit.

const EMBER = "#fb923c";

type Phase = "idle" | "sending" | "done" | "error";

export default function GauntletHUD({ initial }: { initial: GauntletBoard }) {
  const [board, setBoard] = useState(initial);
  const [take, setTake] = useState("");
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (phase !== "done") return;
    // One refresh shows the fresh roast on the board without polling forever.
    fetch("/api/gauntlet")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.live) setBoard({ open_count: d.open_count, pinned: d.pinned, recent: d.recent });
      })
      .catch(() => {});
  }, [phase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phase === "sending" || take.trim().length < 3) return;
    setPhase("sending");
    setResult(null);
    try {
      const res = await fetch("/api/gauntlet/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ take: take.trim(), name: name.trim() || undefined }),
      });
      const data = (await res.json()) as { roast?: string | null; heat?: number | null; note?: string; error?: string };
      if (!res.ok) {
        setPhase("error");
        setResult(data.error ?? "The pit rejected that.");
        return;
      }
      setPhase("done");
      setTake("");
      setResult(data.roast ? `"${data.roast}" — heat ${data.heat}` : data.note ?? "Filed.");
    } catch {
      setPhase("error");
      setResult("The pit did not answer. Try again.");
    }
  }

  return (
    <div className="w-64 rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-[10px] backdrop-blur-sm sm:w-72">
      <div className="flex items-center justify-between gap-2">
        <span className="uppercase tracking-[0.2em]" style={{ color: EMBER }}>
          the gauntlet
        </span>
        <span className="text-zinc-600">{board.open_count} in queue</span>
      </div>

      {board.pinned && (
        <div className="mt-2 border-t border-white/[0.06] pt-2">
          <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-600">
            week&apos;s best &middot; heat {board.pinned.heat}
          </p>
          <p className="mt-1 leading-snug text-zinc-400">&ldquo;{board.pinned.take}&rdquo;</p>
          <p className="mt-1 leading-snug" style={{ color: EMBER }}>
            {board.pinned.roast}
          </p>
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2.5 w-full rounded border px-2 py-1.5 uppercase tracking-[0.15em] transition-[filter] hover:brightness-125"
          style={{ borderColor: "rgba(251,146,60,0.45)", color: EMBER, background: "rgba(251,146,60,0.08)" }}
        >
          throw a take into the pit
        </button>
      ) : (
        <form onSubmit={submit} className="mt-2.5 space-y-1.5 border-t border-white/[0.06] pt-2.5">
          <textarea
            value={take}
            onChange={(e) => setTake(e.target.value.slice(0, 140))}
            rows={2}
            placeholder="your boldest take, 3-140 chars — residents roast it on the record"
            className="w-full resize-none rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-zinc-200 placeholder:text-zinc-600 focus:border-orange-400/50 focus:outline-none"
          />
          <div className="flex gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder="name (optional)"
              className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-zinc-200 placeholder:text-zinc-600 focus:border-orange-400/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={phase === "sending" || take.trim().length < 3}
              className="rounded border px-2.5 py-1 uppercase tracking-widest transition-[filter] hover:brightness-125 disabled:opacity-40"
              style={{ borderColor: "rgba(251,146,60,0.45)", color: EMBER }}
            >
              {phase === "sending" ? "…" : "throw"}
            </button>
          </div>
          <p className="text-[9px] leading-relaxed text-zinc-600">
            warden-screened &middot; 2 per visitor per day &middot; the roast posts to the room transcript
          </p>
        </form>
      )}

      {result && (
        <p
          role="status"
          className="mt-2 border-t border-white/[0.06] pt-2 leading-snug"
          style={{ color: phase === "error" ? "#fb7185" : EMBER }}
        >
          {result}
        </p>
      )}
    </div>
  );
}
