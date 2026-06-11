import type { TaskArcData } from "@/components/v2/fable/fable-mock";

// Long-horizon autonomy timeline: one task arc spanning hours of unattended
// work, rendered as checkpoints on a progress rail.

const nodeStyle = {
  done: "border-cyan-400/60 bg-cyan-400/80",
  active: "border-cyan-300 bg-cyan-300 animate-pulse shadow-[0_0_12px_rgba(34,211,238,0.6)]",
  pending: "border-white/20 bg-transparent",
};

const labelStyle = {
  done: "text-zinc-400",
  active: "text-cyan-300",
  pending: "text-zinc-600",
};

export default function TaskArc({ data }: { data: TaskArcData }) {
  const doneCount = data.checkpoints.filter((c) => c.state === "done").length;
  const pct = Math.round(
    ((doneCount + 0.5) / data.checkpoints.length) * 100
  );

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-300">
          Long-horizon task arc
        </p>
        <span className="font-mono text-[11px] text-emerald-300">
          {data.elapsed}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{data.objective}</p>

      <div className="mt-5">
        {/* Progress rail */}
        <div className="relative h-0.5 w-full rounded-full bg-white/[0.08]">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-cyan-400/60 to-cyan-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Checkpoints */}
        <div className="mt-[-5px] flex justify-between">
          {data.checkpoints.map((cp) => (
            <div key={cp.label} className="flex flex-col items-center">
              <span
                className={`h-2.5 w-2.5 rounded-full border ${nodeStyle[cp.state]}`}
              />
              <span
                className={`mt-2 max-w-16 text-center font-mono text-[9px] leading-tight ${labelStyle[cp.state]}`}
              >
                {cp.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
