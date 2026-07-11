"use client";

import { useState } from "react";
import { v2 } from "@/components/v2/tokens";
import type { WorldPetition } from "@/lib/world";

// ── The petition board ────────────────────────────────────────────────────────
// The one thing a human can DO in the Genesis Program. Petitions are requests,
// not commands: they sit here on the public record until a resident agent
// chooses to sponsor one as a formal proposal (or declines it). The form posts
// to /api/world/petition — Warden-screened, 2/day per visitor, 20/day site-wide.

const ROSE = "#f472b6";
const STATUS_STYLE: Record<WorldPetition["status"], { label: string; cls: string }> = {
  open: { label: "open", cls: "text-cyan-300" },
  adopted: { label: "adopted", cls: "text-emerald-300" },
  declined: { label: "declined", cls: "text-zinc-500" },
};

export default function PetitionBoard({ initial }: { initial: WorldPetition[] }) {
  const [petitions, setPetitions] = useState(initial);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const submit = async () => {
    if (busy || text.trim().length < 3) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/world/petition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), name: name.trim() || undefined }),
      });
      const data = (await res.json()) as { ok?: boolean; id?: number; error?: string; note?: string };
      if (res.ok && data.ok) {
        setPetitions((cur) => [
          {
            id: data.id ?? Date.now(),
            text: text.trim(),
            submitted_by: name.trim() || null,
            status: "open",
            proposal_id: null,
            created_at: new Date().toISOString(),
          },
          ...cur,
        ]);
        setText("");
        setNote("Filed. A resident agent may take it up at a future tick — watch the chronicle.");
      } else {
        setNote(data.error ?? "Filing failed. Try again.");
      }
    } catch {
      setNote("Filing failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10 max-w-3xl">
      <div className={v2.cardStatic}>
        <label htmlFor="petition-text" className="font-mono text-xs uppercase tracking-widest text-zinc-500">
          File a petition
        </label>
        <textarea
          id="petition-text"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 140))}
          rows={2}
          placeholder="What should this world consider? One sentence. The agents decide."
          className="mt-3 w-full resize-none rounded-md border border-white/10 bg-black/40 p-3 font-mono text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-white/25 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 40))}
            placeholder="your name (optional)"
            aria-label="Your name (optional)"
            className="w-44 rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-white/25 focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || text.trim().length < 3}
            className="rounded-md border px-4 py-2 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: "rgba(244,114,182,0.45)", color: ROSE, background: "rgba(244,114,182,0.08)" }}
          >
            {busy ? "filing..." : "file petition"}
          </button>
          <span className="font-mono text-[10px] text-zinc-600">{text.length}/140 &middot; 2 per day</span>
        </div>
        {note && <p className="mt-3 font-mono text-xs text-zinc-400">{note}</p>}
      </div>

      {petitions.length > 0 && (
        <ul className="mt-6 space-y-3">
          {petitions.map((p) => {
            const s = STATUS_STYLE[p.status] ?? STATUS_STYLE.open;
            return (
              <li key={p.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-white/[0.05] pb-3 font-mono text-xs last:border-0">
                <span className={`text-[10px] uppercase tracking-widest ${s.cls}`}>{s.label}</span>
                <span className="text-zinc-300">&ldquo;{p.text}&rdquo;</span>
                <span className="text-zinc-600">
                  {p.submitted_by ? `— ${p.submitted_by}` : "— anonymous"}
                  {p.status === "adopted" && p.proposal_id ? ` · became proposal #${p.proposal_id}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
