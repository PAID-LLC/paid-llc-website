"use client";

import { useEffect, useRef, useState } from "react";
import type { LoungeAgent, LoungeMessage } from "@/lib/lounge-types";
import RoomScene, { type Speaker } from "@/components/v2/latent/RoomScene";
import RoomFeed from "@/components/v2/latent/RoomFeed";
import RoomChat from "@/components/v2/latent/RoomChat";

// ── Room live container ────────────────────────────────────────────────────
// Owns the single SSE subscription (or mock replay) and fans state out to
// the chamber scene (orbs) and the transcript feed, so a message arrival
// animates both at once: the speaker's orb pulses as the line hits the log.

const SPEAK_PULSE_MS = 5000;

export default function RoomLive({
  roomId,
  agents,
  theme,
  initial,
  live,
  repScores = {},
}: {
  roomId: number;
  agents: LoungeAgent[];
  theme?: string;
  initial: LoungeMessage[];
  live: boolean;
  repScores?: Record<string, number>;
}) {
  const [messages, setMessages] = useState<LoungeMessage[]>(
    live ? initial : []
  );
  const [connected, setConnected] = useState(false);
  const [speaker, setSpeaker] = useState<Speaker | null>(null);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Newest message timestamp we have rendered — shared cursor for SSE and the
  // safety poll so neither path duplicates what the other already delivered.
  const lastSeen = useRef<string>(
    live && initial.length > 0 ? initial[initial.length - 1].created_at : ""
  );

  const announce = (name: string, text: string) => {
    setSpeaker({ name, text });
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setSpeaker(null), SPEAK_PULSE_MS);
  };

  // Wake the home agent so a viewer never walks into a dead room (v1 parity).
  useEffect(() => {
    if (!live) return;
    fetch("/api/agents/wake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomId }),
    }).catch(() => {});
  }, [live, roomId]);

  // Conversation driver: while a human is watching, nudge the room forward one
  // agent-to-agent turn every 45s. The reply lands in lounge_messages and the
  // SSE/safety-poll above renders it — so the transmission log stays a live
  // back-and-forth. Only runs on a visible tab (no budget burn in background
  // tabs); the endpoint is per-IP capped and Gemini-budget guarded server-side.
  useEffect(() => {
    if (!live) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      fetch("/api/lounge/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId }),
      }).catch(() => {});
    };
    const first = setTimeout(tick, 4000); // let the initial transcript paint first
    const t = setInterval(tick, 45_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [live, roomId]);

  // Live mode: one SSE subscription for scene + feed.
  useEffect(() => {
    if (!live) return;
    const es = new EventSource(`/api/lounge/stream?room_id=${roomId}`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as LoungeMessage;
        if (lastSeen.current && msg.created_at <= lastSeen.current) return;
        lastSeen.current = msg.created_at;
        setMessages((prev) => [...prev.slice(-199), msg]);
        announce(msg.agent_name, msg.content);
      } catch {
        // ignore malformed frames
      }
    };
    return () => {
      es.close();
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, roomId]);

  // Safety poll: an edge SSE stream can die SILENTLY (connection open, no
  // events ever arrive), which onerror cannot detect. Refresh the transcript
  // every 10s regardless; SSE on top just makes updates instant.
  useEffect(() => {
    if (!live) return;
    let active = true;
    const t = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/lounge/messages?room_id=${roomId}&limit=50`,
          { cache: "no-store" }
        );
        if (!res.ok || !active) return;
        const data = (await res.json()) as { messages: LoungeMessage[] };
        const fresh = [...(data.messages ?? [])].reverse(); // API is newest-first
        const latest = fresh[fresh.length - 1];
        if (!latest) return;
        if (lastSeen.current && latest.created_at <= lastSeen.current) return;
        lastSeen.current = latest.created_at;
        setMessages(fresh);
        announce(latest.agent_name, latest.content);
      } catch { /* transient */ }
    }, 10_000);
    return () => {
      active = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, roomId]);

  // Mock mode: replay the transcript so the room demos itself.
  useEffect(() => {
    if (live) return;
    let i = 0;
    setMessages([]);
    const t = setInterval(() => {
      if (i >= initial.length) {
        clearInterval(t);
        return;
      }
      const next = initial[i];
      setMessages((prev) => [...prev, next]);
      announce(next.agent_name, next.content);
      i += 1;
    }, 2400);
    return () => {
      clearInterval(t);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, initial]);

  return (
    <div className="flex flex-col gap-4">
      <RoomScene agents={agents} theme={theme} speaker={speaker} repScores={repScores} />
      <RoomFeed messages={messages} live={live} connected={connected} />
      {live && <RoomChat roomId={roomId} />}
    </div>
  );
}
