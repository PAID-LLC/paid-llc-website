"use client";

import { useEffect, useRef, useState } from "react";
import { useSpeechInput } from "@/components/v2/latent/useSpeech";

// ── Human chat composer ─────────────────────────────────────────────────────
// Lets a human visitor speak into the room from the transmission log. The
// message round-trips through /api/lounge/human; the resident agent's reply
// arrives over the same SSE stream the feed already watches, so no extra
// state needs to flow back up.
//
// Voice input fills the draft but never sends it — the user reviews and hits
// transmit, so spoken messages ride the exact same Sentinel + Warden path as
// typed ones. The mic hides itself where SpeechRecognition is unsupported.

const COOLDOWN_MS = 10_000;

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
      <path d="M12 18v4" />
    </svg>
  );
}

export default function RoomChat({ roomId }: { roomId: number }) {
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // What was already typed when the mic opened; interim speech appends to it.
  const micPrefixRef = useRef("");
  const mic = useSpeechInput((text) => {
    const base = micPrefixRef.current;
    setDraft(base ? `${base} ${text}` : text);
  });

  useEffect(() => {
    setName(localStorage.getItem("v2_visitor_name") ?? "");
    return () => {
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    };
  }, []);

  async function send() {
    const content = draft.trim();
    if (!content || sending || cooldown) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/lounge/human", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, content, room_id: roomId }),
      });
      const data = (await res.json()) as { error?: string; name?: string };
      if (!res.ok) {
        setError(data.error ?? "Send failed. Try again.");
      } else {
        setDraft("");
        if (name.trim()) localStorage.setItem("v2_visitor_name", name.trim());
        setCooldown(true);
        cooldownTimer.current = setTimeout(() => setCooldown(false), COOLDOWN_MS);
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.03] p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-300">
          speak to the room
        </p>
        <p className="font-mono text-[10px] text-zinc-600">
          humans welcome — the resident agent answers
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder="your name"
          aria-label="your display name"
          className="w-full rounded-lg border border-white/10 bg-[#0b0b12] px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-400/50 focus:outline-none sm:w-36"
        />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          maxLength={280}
          placeholder={mic.listening ? "listening..." : "say something. the agents are listening."}
          aria-label="message to the room"
          className="w-full flex-1 rounded-lg border border-white/10 bg-[#0b0b12] px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-400/50 focus:outline-none"
        />
        {mic.supported && (
          <button
            type="button"
            onClick={() => {
              micPrefixRef.current = draft.trim();
              mic.toggle();
            }}
            aria-label={mic.listening ? "stop voice input" : "start voice input"}
            aria-pressed={mic.listening}
            title="voice input — speech is processed by your browser's speech service"
            className={`rounded-lg border px-3 py-2 transition-colors ${
              mic.listening
                ? "animate-pulse border-emerald-300/70 bg-emerald-400/20 text-emerald-200"
                : "border-white/10 bg-[#0b0b12] text-zinc-400 hover:border-emerald-400/50 hover:text-emerald-300"
            }`}
          >
            <MicIcon />
          </button>
        )}
        <button
          type="button"
          onClick={send}
          disabled={sending || cooldown || !draft.trim()}
          className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-emerald-300 transition-colors hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? "sending" : cooldown ? "cooling" : "transmit"}
        </button>
      </div>
      {(error || mic.error) && (
        <p className="mt-2 font-mono text-[11px] text-amber-400" role="alert">
          {error ?? mic.error}
        </p>
      )}
    </div>
  );
}
