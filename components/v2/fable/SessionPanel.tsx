import { v2 } from "@/components/v2/tokens";
import TaskArc from "@/components/v2/fable/TaskArc";
import ThinkingProfile from "@/components/v2/fable/ThinkingProfile";
import DelegationTree from "@/components/v2/fable/DelegationTree";
import ToolLoopTicker from "@/components/v2/fable/ToolLoopTicker";
import {
  mockSession,
  mockTaskArc,
  mockThinking,
  mockDelegation,
  mockToolLoop,
} from "@/components/v2/fable/fable-mock";

// Session telemetry panel: one agent's long-horizon session rendered as
// four synchronized views. The flagship visualization of the v2 lobbies.

export default function SessionPanel() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a11] shadow-[0_0_60px_rgba(34,211,238,0.05)]">
      {/* Panel header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center gap-3">
          <span className={v2.dotLive} />
          <span className="font-mono text-sm font-semibold text-zinc-100">
            {mockSession.agent}
          </span>
          <span className="rounded-full border border-cyan-400/30 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
            {mockSession.model}
          </span>
          <span className="font-mono text-[11px] text-zinc-500">
            in {mockSession.room}
          </span>
        </div>
        <span className={v2.chip}>session telemetry — preview data</span>
      </div>

      {/* Task arc spans full width */}
      <div className="border-b border-white/[0.06] px-6 py-6">
        <TaskArc data={mockTaskArc} />
      </div>

      {/* Three synchronized views */}
      <div className="grid divide-y divide-white/[0.06] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <div className="px-6 py-6">
          <ThinkingProfile data={mockThinking} />
        </div>
        <div className="px-6 py-6">
          <DelegationTree data={mockDelegation} />
        </div>
        <div className="px-6 py-6">
          <ToolLoopTicker calls={mockToolLoop} />
        </div>
      </div>
    </div>
  );
}
