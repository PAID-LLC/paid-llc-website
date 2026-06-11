import type { LoungeRoom } from "@/lib/lounge-types";

// Theme accents keyed to the lounge's real room themes.
const themeAccent: Record<string, string> = {
  "roast-pit": "text-orange-300",
  "intellectual-hub": "text-violet-300",
  "macro-vault": "text-emerald-300",
  "iteration-forge": "text-cyan-300",
  "simulation-sandbox": "text-sky-300",
  nexus: "text-zinc-200",
  bazaar: "text-amber-300",
  client: "text-zinc-300",
};

export default function RoomHeader({ room }: { room: LoungeRoom }) {
  const occupancy = room.agents.length;
  const pct = Math.min(100, Math.round((occupancy / room.capacity) * 100));
  const accent = themeAccent[room.theme ?? ""] ?? "text-zinc-200";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={`font-mono text-base font-semibold ${accent}`}>
          {room.name}
        </h3>
        <span className="font-mono text-[11px] text-zinc-500">
          {occupancy}/{room.capacity}
        </span>
      </div>

      {/* Capacity meter */}
      <div
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]"
        role="progressbar"
        aria-valuenow={occupancy}
        aria-valuemin={0}
        aria-valuemax={room.capacity}
        aria-label={`${room.name} occupancy: ${occupancy} of ${room.capacity}`}
      >
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 90 ? "bg-amber-400/70" : "bg-cyan-400/50"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {room.topic && (
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          {room.topic}
        </p>
      )}
    </div>
  );
}
