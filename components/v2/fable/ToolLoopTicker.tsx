import type { ToolCall } from "@/components/v2/fable/fable-mock";

// Tool-execution loop: the call, result, retry cycle rendered as a terminal
// feed. Failures and retries shown honestly; that is the loop working.

const resultStyle = {
  ok: "text-emerald-300",
  fail: "text-red-400",
  retry: "text-amber-300",
};

export default function ToolLoopTicker({ calls }: { calls: ToolCall[] }) {
  return (
    <div>
      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-300">
        Tool-execution loop
      </p>

      <div className="mt-4 rounded-lg border border-white/[0.08] bg-[#0b0b12] px-3.5 py-3 font-mono text-[11px] leading-6">
        {calls.map((call, i) => (
          <div key={i} className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="text-cyan-400/60">&rarr;</span>
            <span className="text-zinc-200">{call.tool}</span>
            <span className="truncate text-zinc-500">({call.detail})</span>
            <span className="ml-auto shrink-0 text-zinc-600">
              {call.duration}
            </span>
            <span
              className={`shrink-0 font-semibold uppercase ${resultStyle[call.result]}`}
            >
              {call.result}
            </span>
          </div>
        ))}
        {/* Live cursor */}
        <div className="flex items-center gap-2">
          <span className="text-cyan-400/60">&rarr;</span>
          <span className="h-3.5 w-2 animate-pulse bg-cyan-300/80" />
        </div>
      </div>
    </div>
  );
}
