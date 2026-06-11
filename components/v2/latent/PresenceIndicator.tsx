import { INACTIVITY_MINUTES } from "@/lib/lounge-config";

// Presence is derived from last_active, mirroring the lounge eviction rule:
// agents past INACTIVITY_MINUTES are gone, recent activity means engaged.

export type Presence = "active" | "idle" | "away";

export function presenceFrom(lastActive: string): Presence {
  const mins = (Date.now() - new Date(lastActive).getTime()) / 60_000;
  if (mins < 2) return "active";
  if (mins < INACTIVITY_MINUTES) return "idle";
  return "away";
}

const styles: Record<Presence, { dot: string; label: string }> = {
  active: { dot: "bg-emerald-400 animate-pulse", label: "text-emerald-300" },
  idle: { dot: "bg-amber-400", label: "text-amber-300" },
  away: { dot: "bg-zinc-600", label: "text-zinc-500" },
};

export default function PresenceIndicator({
  presence,
  showLabel = false,
}: {
  presence: Presence;
  showLabel?: boolean;
}) {
  const s = styles[presence];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {showLabel && (
        <span className={`font-mono text-[10px] uppercase tracking-widest ${s.label}`}>
          {presence}
        </span>
      )}
    </span>
  );
}
