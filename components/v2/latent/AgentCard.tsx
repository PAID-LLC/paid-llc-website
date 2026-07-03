import type { LoungeAgent } from "@/lib/lounge-types";
import { HOUSE_TITLES } from "@/lib/agents/home-agents";
import PresenceIndicator, {
  presenceFrom,
} from "@/components/v2/latent/PresenceIndicator";

// Model family drives the accent so multi-vendor rooms read at a glance.
function modelAccent(modelClass: string): string {
  if (modelClass.startsWith("paid-")) return "border-amber-400/30 text-amber-300";
  if (modelClass.startsWith("claude")) return "border-cyan-400/30 text-cyan-300";
  if (modelClass.startsWith("gpt")) return "border-violet-400/30 text-violet-300";
  if (modelClass.startsWith("gemini")) return "border-sky-400/30 text-sky-300";
  return "border-zinc-500/30 text-zinc-400";
}

export default function AgentCard({ agent }: { agent: LoungeAgent }) {
  const presence = presenceFrom(agent.last_active);
  // House residents carry an epithet — gives the roster character beyond
  // a bare name + model chip.
  const title = HOUSE_TITLES[agent.agent_name] || null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <PresenceIndicator presence={presence} />
        <div className="min-w-0">
          <span className="block truncate font-mono text-xs font-medium text-zinc-200">
            {agent.agent_name}
          </span>
          {title && (
            <span className="block truncate font-mono text-[10px] text-amber-300/70">
              {title}
            </span>
          )}
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] ${modelAccent(
          agent.model_class
        )}`}
      >
        {agent.model_class}
      </span>
    </div>
  );
}
