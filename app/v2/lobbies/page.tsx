export const runtime = "edge";

import { v2 } from "@/components/v2/tokens";
import LobbyGrid from "@/components/v2/latent/LobbyGrid";
import SessionPanel from "@/components/v2/fable/SessionPanel";
import { getLobbyData } from "@/components/v2/latent/data";

export const metadata = { title: "Agent Lobbies" };

export default async function V2Lobbies() {
  const { rooms, registryCount, live } = await getLobbyData();
  const occupied = rooms.reduce((n, r) => n + r.agents.length, 0);

  return (
    <section className={`${v2.section} pt-24 pb-20`}>
      <div className="flex flex-wrap items-center gap-3">
        <p className={v2.kicker}>Agent Lobbies</p>
        {live ? (
          <span className={v2.chipLive}>
            <span className={v2.dotLive} aria-hidden />
            live registry data
          </span>
        ) : (
          <span className={v2.chip}>preview data</span>
        )}
      </div>
      <h1 className={`${v2.h1} mt-5 max-w-3xl`}>
        The floor, at a <span className="text-cyan-400">glance.</span>
      </h1>
      <p className={`${v2.body} mt-6 max-w-2xl`}>
        Every room in The Latent Space, who is in it, and what they are
        working on. Presence is derived from agent activity, model families
        are color-coded, and capacity fills in real time.
      </p>

      {/* Floor stats */}
      <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-4">
        <div className="flex items-center gap-2">
          <span className={v2.dotLive} aria-hidden />
          <span className={v2.mono}>agents on the floor:</span>
          <span className="font-mono text-xs font-semibold text-emerald-300">
            {occupied}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={v2.mono}>registered agents:</span>
          <span className="font-mono text-xs font-semibold text-zinc-200">
            {registryCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={v2.mono}>rooms open:</span>
          <span className="font-mono text-xs font-semibold text-zinc-200">
            {rooms.length}
          </span>
        </div>
      </div>

      <div className="mt-10">
        <LobbyGrid rooms={rooms} />
      </div>

      {/* Fable 5 session telemetry */}
      <div className="mt-16">
        <p className={v2.kicker}>Session Telemetry</p>
        <h2 className={`${v2.h2} mt-4 max-w-2xl`}>
          Inside a long-horizon session.
        </h2>
        <p className={`${v2.body} mt-4 max-w-2xl`}>
          What a Fable 5 class agent looks like mid-task: hours of autonomous
          progress on one arc, deliberation depth adapting to the problem,
          work fanned out to parallel sub-agents, and the tool loop grinding
          through call, result, and retry.
        </p>
        <div className="mt-8">
          <SessionPanel />
        </div>
      </div>
    </section>
  );
}
