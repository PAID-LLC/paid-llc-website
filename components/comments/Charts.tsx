// ── The four charts ──────────────────────────────────────────────────────────
// All inline SVG, all server components, zero JavaScript shipped. The geometry
// lives in lib/comments/render-helpers.ts so it can be unit tested; this file is
// only markup and colour.
//
// Colour follows the v2 two-tone rule: cyan is the data/system accent, terracotta
// is the human/brand lead. Positive sentiment is cyan, negative is terracotta,
// neutral is zinc. Amber appears in exactly one place on this page, the
// automation meter above 15%, because amber is the warning colour here and
// spending it on ordinary data would leave nothing to say "look at this".

import { ringArcs, sparklinePath, pct, formatCount } from "@/lib/comments/render-helpers";
import { signalLabel } from "@/lib/comments/bots";
import type { AutomationSummary } from "@/lib/comments/types";

interface Shares {
  positive: number;
  neutral: number;
  negative: number;
}

const ARC_COLORS: Record<string, string> = {
  positive: "#22d3ee", // cyan-400
  neutral: "#3f3f46", // zinc-700
  negative: "#C14826", // terracotta
};

/** Donut. Sized by the caller; 100 is the default diameter. */
export function SentimentRing({ shares, size = 104 }: { shares: Shares; size?: number }) {
  const stroke = Math.max(6, Math.round(size * 0.1));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcs = ringArcs(shares, circumference);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Sentiment: ${pct(shares.positive)} positive, ${pct(shares.neutral)} neutral, ${pct(shares.negative)} negative`}
      className="shrink-0"
    >
      {/* Rotated so the first arc starts at twelve o'clock rather than three. */}
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ARC_COLORS[arc.key] ?? "#3f3f46"}
            strokeWidth={stroke}
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={arc.offset}
            className="cs-draw"
            style={
              {
                "--cs-draw-from": `${circumference}`,
                "--cs-draw-to": `${arc.offset}`,
              } as React.CSSProperties
            }
          />
        ))}
      </g>
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-zinc-100 font-mono font-bold"
        style={{ fontSize: size * 0.22 }}
      >
        {pct(shares.positive)}
      </text>
    </svg>
  );
}

/** Stacked horizontal bar with a legend underneath. */
export function SentimentBar({ shares, analyzed }: { shares: Shares; analyzed: number }) {
  const segments = [
    { key: "positive", label: "positive", value: shares.positive },
    { key: "neutral", label: "neutral", value: shares.neutral },
    { key: "negative", label: "negative", value: shares.negative },
  ];

  return (
    <div>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.04]"
        role="img"
        aria-label={`Of ${formatCount(analyzed)} comments: ${segments.map((s) => `${pct(s.value)} ${s.label}`).join(", ")}`}
      >
        {segments
          .filter((s) => s.value > 0.001)
          .map((s, i) => (
            <div
              key={s.key}
              className="cs-grow h-full"
              style={{
                width: `${s.value * 100}%`,
                background: ARC_COLORS[s.key],
                animationDelay: `${i * 90}ms`,
              }}
            />
          ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-zinc-500">
        {segments.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: ARC_COLORS[s.key] }} />
            {pct(s.value)} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Comment volume over the first 24 hours after upload. */
export function VelocitySparkline({
  velocity,
  busiestHour,
  width = 260,
  height = 44,
}: {
  velocity: number[];
  busiestHour: number;
  width?: number;
  height?: number;
}) {
  if (!velocity?.length || velocity.every((v) => v === 0)) return null;

  const { line, area, peakX, peakY } = sparklinePath(velocity, width, height);
  const total = velocity.reduce((a, b) => a + b, 0);

  return (
    <div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Comment volume peaked ${busiestHour} hours after upload`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="cs-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#cs-spark-fill)" />
        <path
          d={line}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="1.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={peakX} cy={peakY} r="2.5" fill="#22d3ee" />
      </svg>
      <p className="mt-1.5 font-mono text-[11px] text-zinc-500">
        {formatCount(total)} comments, busiest {busiestHour === 0 ? "in the first hour" : `${busiestHour} hours`} after upload
      </p>
    </div>
  );
}

/**
 * The automation estimate.
 *
 * Aggregate only, and the copy says "estimate" rather than stating a fact,
 * because this is a heuristic reading of other people's accounts. The signal
 * chips describe what the section did, never who did it.
 */
export function AutomationMeter({ automation }: { automation: AutomationSummary }) {
  const likely = automation.shareLikely ?? 0;
  const suspicious = automation.shareSuspicious ?? 0;
  const elevated = likely >= 0.15;

  const topSignals = Object.entries(automation.signals ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
          Estimated automated
        </span>
        <span
          className={`font-mono text-lg font-bold ${elevated ? "text-amber-300" : "text-zinc-200"}`}
        >
          {pct(likely)}
        </span>
      </div>

      <div
        className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-white/[0.04]"
        role="img"
        aria-label={`Estimated ${pct(likely)} likely automated, ${pct(suspicious)} suspicious`}
      >
        <div
          className={`cs-grow h-full ${elevated ? "bg-amber-400/80" : "bg-zinc-500"}`}
          style={{ width: `${likely * 100}%` }}
        />
        <div
          className="cs-grow h-full bg-zinc-600/40"
          style={{ width: `${suspicious * 100}%`, animationDelay: "90ms" }}
        />
      </div>

      {topSignals.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {topSignals.map(([signal, count]) => (
            <li key={signal} className="font-mono text-[11px] text-zinc-500">
              <span className="text-zinc-400">{formatCount(count)}</span> {signalLabel(signal)}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 font-mono text-[10px] leading-relaxed text-zinc-600">
        PAID LLC estimate, not a YouTube metric. Describes the section in aggregate,
        never an individual account.
        {automation.confidence === "low" && " Low confidence: limited account data."}
      </p>
    </div>
  );
}
