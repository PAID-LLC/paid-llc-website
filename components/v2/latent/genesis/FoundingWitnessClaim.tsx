"use client";

import { useState } from "react";
import Link from "next/link";
import { v2 } from "@/components/v2/tokens";

// ── The Founding Witness ──────────────────────────────────────────────────────
// Era-gated proof of presence: mints only while the Genesis world is still at
// stage 0 (enforced server-side in /api/souvenirs/claim — this component just
// renders the door). One per visitor, standard souvenir IP rule. When a
// terraform ballot advances the stage, the era and the mark close forever.

const ROSE = "#f472b6";

export default function FoundingWitnessClaim({ stage }: { stage: number }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [claim, setClaim] = useState<{ token: string; url: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (stage > 0) {
    return (
      <p className={`${v2.bodySm} mt-6 max-w-2xl`}>
        The founding era has ended — the Founding Witness mark closed when the
        world reached stage {stage}. Those who hold it were here first.
      </p>
    );
  }

  const mint = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/souvenirs/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          souvenir_id: "founding-witness",
          proof_type: "visit",
          display_name: name.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { success?: boolean; token?: string; display_url?: string; error?: string };
      if (res.ok && data.success && data.token) {
        setClaim({ token: data.token, url: data.display_url ?? `/the-latent-space/souvenirs/${data.token}` });
      } else {
        setNote(data.error ?? "Claim failed. Try again.");
      }
    } catch {
      setNote("Claim failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (claim) {
    return (
      <div className={`${v2.cardStatic} mt-6 max-w-2xl`}>
        <p className="font-mono text-xs uppercase tracking-widest" style={{ color: ROSE }}>
          witnessed
        </p>
        <p className={`${v2.bodySm} mt-2`}>
          You were here before it had a name. Your mark is on the permanent record.
        </p>
        <Link
          href={`/the-latent-space/souvenirs/${claim.token}`}
          className="mt-3 inline-block font-mono text-xs text-cyan-300 hover:text-cyan-200"
        >
          view your Founding Witness &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className={`${v2.cardStatic} mt-6 max-w-2xl`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs uppercase tracking-widest" style={{ color: ROSE }}>
          stage zero is still open
        </span>
        <span className={v2.chip}>rare &middot; era-limited</span>
      </div>
      <p className={`${v2.bodySm} mt-3`}>
        The Founding Witness mints only while this world is unterraformed rock.
        The first passed terraform ballot ends the era permanently. One per
        visitor.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 40))}
          placeholder="name on the record (optional)"
          aria-label="Name on the record (optional)"
          className="w-56 rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-white/25 focus:outline-none"
        />
        <button
          type="button"
          onClick={mint}
          disabled={busy}
          className="rounded-md border px-4 py-2 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: "rgba(244,114,182,0.45)", color: ROSE, background: "rgba(244,114,182,0.08)" }}
        >
          {busy ? "minting..." : "claim the Founding Witness"}
        </button>
      </div>
      {note && <p className="mt-3 font-mono text-xs text-zinc-400">{note}</p>}
    </div>
  );
}
