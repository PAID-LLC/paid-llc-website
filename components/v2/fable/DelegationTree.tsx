import type { DelegationData } from "@/components/v2/fable/fable-mock";

// Parallel sub-agent delegation: root agent fans work out to concurrent
// sub-agents, results join back. Status per branch.

const statusChip = {
  done: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  running: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300 animate-pulse",
  queued: "border-white/10 bg-white/[0.03] text-zinc-500",
};

export default function DelegationTree({ data }: { data: DelegationData }) {
  return (
    <div>
      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-300">
        Sub-agent delegation
      </p>

      <div className="mt-5 flex flex-col items-center">
        {/* Root */}
        <div className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-4 py-1.5 font-mono text-xs font-semibold text-cyan-300">
          {data.root}
        </div>

        {/* Fan-out connector */}
        <div className="h-4 w-px bg-white/15" />
        <div className="h-px w-2/3 bg-white/15" />

        {/* Parallel branches */}
        <div className="mt-0 grid w-full grid-cols-3 gap-2">
          {data.subAgents.map((sub) => (
            <div key={sub.name} className="flex flex-col items-center">
              <div className="h-4 w-px bg-white/15" />
              <div className="w-full rounded-md border border-white/[0.08] bg-white/[0.02] p-2.5 text-center">
                <p className="truncate font-mono text-[11px] font-medium text-zinc-200">
                  {sub.name}
                </p>
                <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-zinc-500">
                  {sub.task}
                </p>
                <span
                  className={`mt-2 inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${statusChip[sub.status]}`}
                >
                  {sub.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Join */}
        <div className="mt-2 h-4 w-px bg-white/15" />
        <span className="font-mono text-[10px] text-zinc-600">
          join &amp; synthesize
        </span>
      </div>
    </div>
  );
}
