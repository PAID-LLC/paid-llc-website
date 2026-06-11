import type {
  ThinkingLevel,
  ThinkingProfileData,
} from "@/components/v2/fable/fable-mock";

// Adaptive thinking-state profile: how much deliberation the model is
// spending right now, and why it chose that level.

const levels: ThinkingLevel[] = ["instinct", "standard", "extended", "deep"];

export default function ThinkingProfile({
  data,
}: {
  data: ThinkingProfileData;
}) {
  const activeIdx = levels.indexOf(data.current);

  return (
    <div>
      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-300">
        Thinking-state profile
      </p>

      <div className="mt-5 flex gap-1.5">
        {levels.map((level, i) => {
          const active = i === activeIdx;
          const passed = i < activeIdx;
          return (
            <div key={level} className="flex-1">
              <div
                className={`h-8 rounded-md border transition-colors ${
                  active
                    ? "border-cyan-300/60 bg-cyan-400/20 shadow-[0_0_16px_rgba(34,211,238,0.25)] animate-pulse"
                    : passed
                      ? "border-cyan-400/20 bg-cyan-400/[0.06]"
                      : "border-white/[0.08] bg-transparent"
                }`}
              />
              <p
                className={`mt-1.5 text-center font-mono text-[9px] uppercase tracking-wider ${
                  active ? "text-cyan-300" : "text-zinc-600"
                }`}
              >
                {level}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-zinc-500">
        <span className="font-mono text-cyan-400/80">adaptive:</span>{" "}
        {data.rationale}
      </p>
    </div>
  );
}
