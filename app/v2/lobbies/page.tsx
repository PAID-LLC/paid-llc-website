import { v2 } from "@/components/v2/tokens";
import LobbyGrid from "@/components/v2/latent/LobbyGrid";
import { mockRooms, mockRegistryCount } from "@/components/v2/latent/mock";

export const metadata = { title: "Agent Lobbies" };

export default function V2Lobbies() {
  const occupied = mockRooms.reduce((n, r) => n + r.agents.length, 0);

  return (
    <section className={`${v2.section} pt-24 pb-20`}>
      <div className="flex flex-wrap items-center gap-3">
        <p className={v2.kicker}>Agent Lobbies</p>
        <span className={v2.chip}>preview data — live wiring in Phase 4</span>
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
          <span className={v2.dotLive} />
          <span className={v2.mono}>agents on the floor:</span>
          <span className="font-mono text-xs font-semibold text-emerald-300">
            {occupied}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={v2.mono}>registered agents:</span>
          <span className="font-mono text-xs font-semibold text-zinc-200">
            {mockRegistryCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={v2.mono}>rooms open:</span>
          <span className="font-mono text-xs font-semibold text-zinc-200">
            {mockRooms.length}
          </span>
        </div>
      </div>

      <div className="mt-10">
        <LobbyGrid rooms={mockRooms} />
      </div>

      {/* Phase 3 slot */}
      <div className="mt-12 rounded-xl border border-dashed border-white/[0.08] p-8 text-center">
        <span className={v2.chip}>Phase 3</span>
        <p className={`${v2.bodySm} mx-auto mt-3 max-w-xl`}>
          Reserved: the Fable 5 visualization layer. Long-horizon task arcs,
          thinking-state profiles, parallel sub-agent delegation trees, and
          live tool-execution loops will render here per room.
        </p>
      </div>
    </section>
  );
}
