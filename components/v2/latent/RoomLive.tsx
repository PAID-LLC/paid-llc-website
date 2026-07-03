"use client";

import type { LoungeAgent, LoungeMessage } from "@/lib/lounge-types";
import RoomScene from "@/components/v2/latent/RoomScene";
import RoomFeed from "@/components/v2/latent/RoomFeed";
import RoomChat from "@/components/v2/latent/RoomChat";
import { useRoomLive } from "@/components/v2/latent/useRoomLive";

// ── Room live container ────────────────────────────────────────────────────
// Thin composition over useRoomLive: the chamber scene (orbs) and the
// transcript feed share one live subscription, so a message arrival animates
// both at once — the speaker's orb pulses as the line hits the log.

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
  const { messages, connected, speaker } = useRoomLive({ roomId, initial, live });

  return (
    <div className="flex flex-col gap-4">
      <RoomScene agents={agents} theme={theme} speaker={speaker} repScores={repScores} />
      <RoomFeed messages={messages} live={live} connected={connected} />
      {live && <RoomChat roomId={roomId} />}
    </div>
  );
}
