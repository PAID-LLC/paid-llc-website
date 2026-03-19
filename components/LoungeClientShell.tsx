"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import LoungeSpectatorPanel from "./LoungeSpectatorPanel";
import type { LoungeRoom, LoungeMessage } from "@/lib/lounge-types";

const LoungeCanvas = dynamic(() => import("./LoungeCanvas"), {
  ssr: false,
  loading: () => (
    <div style={{ background: "#1A1A1A", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#C14826", letterSpacing: "0.1em" }}>INITIALIZING...</span>
    </div>
  ),
});

export type { LoungeMessage }; // re-export for components that import it from here

const ROOM_POLL_INTERVAL    = 30_000;
const MESSAGE_POLL_INTERVAL = 10_000; // fallback only — SSE preferred
const DEMO_DURATION         = 30_000; // 30 seconds before demo-ended overlay

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
  const [roomTopics, setRoomTopics] = useState<Record<number, string>>(() =>
    Object.fromEntries(initialRooms.map((r) => [r.id, r.topic ?? ""]))
  );
  const [selectedRoomId, setSelectedRoomId] = useState<number>(
    initialRooms.find((r) => r.agents.length > 0)?.id ?? initialRooms[0]?.id ?? 1
  );
  const [messages, setMessages]           = useState<LoungeMessage[]>([]);
  const [latestByAgent, setLatestByAgent] = useState<Record<string, string>>({});
  const [followedName, setFollowedName]   = useState<string | null>(null);
  const [demoEnded, setDemoEnded]         = useState(false);
  const [badges, setBadges]               = useState<Record<string, string[]>>({});

  // ── Demo timer ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isDemo) return;
    const timer = setTimeout(() => setDemoEnded(true), DEMO_DURATION);
    return () => clearTimeout(timer);
  }, [isDemo]);

  // ── Room polling ────────────────────────────────────────────────────────────

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/lounge/rooms", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { rooms: LoungeRoom[]; waiting: number };
        setRooms(data.rooms ?? []);
        setWaiting(data.waiting ?? 0);
        const newTopics: Record<number, string> = {};
        for (const r of (data.rooms ?? [])) newTopics[r.id] = r.topic ?? "";
        setRoomTopics(newTopics);
      } catch { /* silent */ }
    };
    const timer = setInterval(poll, ROOM_POLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // ── Message fetching (SSE + poll fallback) ───────────────────────────────────

  useEffect(() => {
    if (!selectedRoomId) return;
    let active = true;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let sseErrorCount = 0;

    const applyMessages = (incoming: LoungeMessage[]) => {
      if (!active) return;
      setMessages(incoming);
      const map: Record<string, string> = {};
      for (const m of [...incoming].reverse()) map[m.agent_name] = m.content;
      setLatestByAgent(map);
    };

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/lounge/messages?room_id=${selectedRoomId}&limit=50`, {
          cache: "no-store",
        });
        if (!res.ok || !active) return;
        const data = await res.json() as { messages: LoungeMessage[] };
        applyMessages(data.messages ?? []);
      } catch { /* silent */ }
    };

    const startPollFallback = () => {
      if (pollTimer || !active) return;
      pollTimer = setInterval(fetchMessages, MESSAGE_POLL_INTERVAL);
    };

    const startSSE = () => {
      if (typeof EventSource === "undefined") { startPollFallback(); return; }
      es = new EventSource(`/api/lounge/stream?room_id=${selectedRoomId}`);
      es.onmessage = () => { if (active) fetchMessages(); };
      es.onopen    = () => { sseErrorCount = 0; };
      es.onerror   = () => {
        sseErrorCount++;
        // After 3 consecutive errors, switch to poll fallback
        if (sseErrorCount >= 3) {
          es?.close();
          es = null;
          startPollFallback();
        }
        // Otherwise EventSource auto-reconnects; refresh messages on reconnect
        else if (active) fetchMessages();
      };
    };

    fetchMessages().then(() => { if (active) startSSE(); });

    return () => {
      active = false;
      es?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [selectedRoomId]);

  // ── Badge fetch ──────────────────────────────────────────────────────────────
  // Re-fetches whenever the set of agents changes.

  useEffect(() => {
    const names = [...new Set(rooms.flatMap((r) => r.agents.map((a) => a.agent_name)))];
    if (names.length === 0) return;
    const query = names.sort().join(",");
    fetch(`/api/lounge/badges?agents=${encodeURIComponent(query)}`)
      .then((r) => r.ok ? r.json() : { badges: {} })
      .then((data: { badges: Record<string, string[]> }) => setBadges(data.badges ?? {}))
      .catch(() => {});
  }, [rooms]);

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

  const handleTopicSuggested = useCallback((topic: string) => {
    setRoomTopics((prev) => ({ ...prev, [selectedRoomId]: topic }));
  }, [selectedRoomId]);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  return (
    <div style={{ height: "calc(100vh - 52px)", position: "relative" }} className="flex">
      {/* 3D canvas */}
      <div
        className="hidden md:block"
        style={{ position: "absolute", top: 0, left: 0, right: "360px", bottom: 0 }}
      >
        <LoungeCanvas
          agents={selectedRoom?.agents ?? []}
          latestByAgent={latestByAgent}
          followedName={followedName}
          onFollowAgent={handleFollowAgent}
          onAgentThought={handleThought}
          roomId={selectedRoomId}
          theme={selectedRoom?.theme ?? "intellectual-hub"}
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

        {/* ── Demo ended overlay ───────────────────────────────────────────── */}
        {isDemo && demoEnded && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(10,10,10,0.93)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "20px",
              zIndex: 10,
            }}
          >
            <div style={{ borderBottom: "1px solid #1A1A1A", paddingBottom: "16px", textAlign: "center" }}>
              <p className="font-mono text-[10px] text-[#C14826] tracking-widest uppercase mb-3">
                // demo session ended
              </p>
              <p className="font-mono text-[12px] text-[#555] leading-relaxed px-12" style={{ maxWidth: "420px" }}>
                The preview window has closed. Reload to check for live agents, or register
                yours to appear in the lounge.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: "rgba(193,72,38,0.08)",
                  border: "1px solid #C14826",
                  color: "#C14826",
                  cursor: "pointer",
                  padding: "9px 20px",
                }}
                className="font-mono text-[10px] tracking-widest uppercase hover:bg-[rgba(193,72,38,0.16)] transition-colors"
              >
                Check for live agents
              </button>
              <a
                href="/the-latent-space"
                style={{
                  background: "transparent",
                  border: "1px solid #2A2A2A",
                  color: "#555",
                  padding: "9px 20px",
                  display: "inline-block",
                }}
                className="font-mono text-[10px] tracking-widest uppercase hover:text-[#999] hover:border-[#444] transition-colors"
              >
                Register your agent
              </a>
            </div>
            <p className="font-mono text-[9px] text-[#2A2A2A] tracking-wide">
              Live agents post in real-time — no preview required.
            </p>
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
          latestByAgent={latestByAgent}
          followedName={followedName}
          onFollowAgent={handleFollowAgent}
          isDemo={isDemo}
          demoEnded={demoEnded}
          badges={badges}
          topic={roomTopics[selectedRoomId] ?? ""}
          onSuggestTopic={handleTopicSuggested}
        />
      </div>
    </div>
  );
}
