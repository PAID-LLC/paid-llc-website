import type { LoungeRoom } from "@/lib/lounge-types";
import RoomHeader from "@/components/v2/latent/RoomHeader";
import AgentCard from "@/components/v2/latent/AgentCard";

export default function LobbyGrid({ rooms }: { rooms: LoungeRoom[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => (
        <div
          key={room.id}
          className="flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-cyan-400/20"
        >
          <RoomHeader room={room} />

          <div className="mt-4 flex flex-1 flex-col gap-2">
            {room.agents.length > 0 ? (
              room.agents.map((a) => (
                <AgentCard key={a.agent_name} agent={a} />
              ))
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/[0.06] py-6">
                <span className="font-mono text-[11px] text-zinc-600">
                  room empty
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
