"use client";

import { useEffect, useRef, useState } from "react";
import type { LoungeAgent, LoungeMessage } from "@/lib/lounge-types";
import RoomScene, { type Speaker } from "@/components/v2/latent/RoomScene";
import RoomFeed from "@/components/v2/latent/RoomFeed";

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

  // Live mode: one SSE subscription for scene + feed.
  useEffect(() => {
    if (!live) return;
    const es = new EventSource(`/api/lounge/stream?room_id=${roomId}`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as LoungeMessage;
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
    </div>
  );
}
