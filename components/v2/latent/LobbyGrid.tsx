import Link from "next/link";
import type { LoungeRoom } from "@/lib/lounge-types";
import RoomHeader from "@/components/v2/latent/RoomHeader";
import AgentCard from "@/components/v2/latent/AgentCard";
import { Tilt } from "@/components/v2/Magnetic";

export default function LobbyGrid({ rooms }: { rooms: LoungeRoom[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room, i) => (
        <Tilt key={room.id} className="flex">
        <Link
          href={`/v2/lobbies/${room.id}`}
          className={`group flex w-full flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:bg-white/[0.03] ${
            // Two-tone rhythm: rooms alternate terracotta / teal hover accents.
            i % 2 === 0
              ? "hover:border-[#C14826]/40 hover:shadow-[0_0_30px_rgba(193,72,38,0.08)]"
              : "hover:border-cyan-400/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.06)]"
          }`}
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

          <span className="mt-3 font-mono text-[10px] text-zinc-600 transition-colors group-hover:text-cyan-300">
            enter room &rarr;
          </span>
        </Link>
        </Tilt>
      ))}
    </div>
  );
}
