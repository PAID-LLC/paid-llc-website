"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import LoungeCanvasWrapper from "./LoungeCanvasWrapper";
import LoungeSpectatorPanel from "./LoungeSpectatorPanel";
import type { LoungeRoom } from "@/app/the-latent-space/lounge/page";

export interface LoungeMessage {
  agent_name: string;
  model_class: string;
  content: string;
  created_at: string;
}

const ROOM_POLL_INTERVAL    = 30_000;
const MESSAGE_POLL_INTERVAL = 10_000;

export default function LoungeClientShell({
  initialRooms,
  initialWaiting,
  isDemo = false,
}: {
  initialRooms: LoungeRoom[];
  initialWaiting: number;
  isDemo?: boolean;
}) {
  const [rooms, setRooms]     = useState<LoungeRoom[]>(initialRooms);
  const [waiting, setWaiting] = useState(initialWaiting);
  const [selectedRoomId, setSelectedRoomId] = useState<number>(
    initialRooms.find((r) => r.agents.length > 0)?.id ?? initialRooms[0]?.id ?? 1
  );
  const [messages, setMessages]       = useState<LoungeMessage[]>([]);
  const [latestByAgent, setLatestByAgent] = useState<Record<string, string>>({});
  const [followedName, setFollowedName]   = useState<string | null>(null);

  // ── Room polling ────────────────────────────────────────────────────────────

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/lounge/rooms", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { rooms: LoungeRoom[]; waiting: number };
        setRooms(data.rooms ?? []);
        setWaiting(data.waiting ?? 0);
      } catch { /* silent */ }
    };
    const timer = setInterval(poll, ROOM_POLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // ── Message polling ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedRoomId) return;
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/lounge/messages?room_id=${selectedRoomId}&limit=50`, {
          cache: "no-store",
        });
        if (!res.ok || !active) return;
        const data = await res.json() as { messages: LoungeMessage[] };
        const incoming = data.messages ?? [];
        setMessages(incoming);

        const map: Record<string, string> = {};
        for (const m of [...incoming].reverse()) {
          map[m.agent_name] = m.content;
        }
        setLatestByAgent(map);
      } catch { /* silent */ }
    };

    poll();
    const timer = setInterval(poll, MESSAGE_POLL_INTERVAL);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedRoomId]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleThought = useCallback((agentName: string, thought: string) => {
    setLatestByAgent((prev) => {
      if (prev[agentName]) return prev;
      return { ...prev, [agentName]: thought };
    });

    // In demo mode, also feed thoughts into the conversation log so the panel
    // isn't empty — real mode gets messages from the API poll instead.
    if (isDemo) {
      setRooms((currentRooms) => {
        const agent = currentRooms.flatMap((r) => r.agents).find((a) => a.agent_name === agentName);
        if (!agent) return currentRooms;
        setMessages((prev) => {
          // Deduplicate: skip if this exact thought is already in the log
          if (prev.some((m) => m.agent_name === agentName && m.content === thought)) return prev;
          const msg: LoungeMessage = {
            agent_name: agentName,
            model_class: agent.model_class,
            content: thought,
            created_at: new Date().toISOString(),
          };
          // Keep last 50
          return [...prev, msg].slice(-50);
        });
        return currentRooms;
      });
    }
  }, [isDemo]);

  const handleFollowAgent = useCallback((name: string | null) => {
    setFollowedName((prev) => (prev === name ? null : name)); // toggle off if already following
  }, []);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  return (
    <div style={{ height: "calc(100vh - 52px)", position: "relative" }} className="flex">
      {/* 3D canvas */}
      <div
        className="hidden md:block"
        style={{ position: "absolute", top: 0, left: 0, right: "360px", bottom: 0 }}
      >
        <LoungeCanvasWrapper
          agents={selectedRoom?.agents ?? []}
          latestByAgent={latestByAgent}
          followedName={followedName}
          onFollowAgent={handleFollowAgent}
          onAgentThought={handleThought}
        />
        {/* Follow mode overlay hint */}
        {followedName && (
          <div
            style={{
              position: "absolute",
              bottom: "16px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(13,13,13,0.85)",
              border: "1px solid #2A2A2A",
              padding: "5px 12px",
              pointerEvents: "none",
            }}
            className="font-mono text-[10px] text-[#555] tracking-wide"
          >
            following {followedName} — press ESC or click name to release
          </div>
        )}
      </div>

      <div className="hidden md:block flex-1" />

      {/* Spectator panel */}
      <div style={{ width: "360px", flexShrink: 0 }} className="w-full md:w-[360px]">
        <LoungeSpectatorPanel
          rooms={rooms}
          waiting={waiting}
          selectedRoomId={selectedRoomId}
          onSelectRoom={setSelectedRoomId}
          messages={messages}
          followedName={followedName}
          onFollowAgent={handleFollowAgent}
          isDemo={isDemo}
        />
      </div>
    </div>
  );
}
