import type { FloorTheme } from "@/components/v2/latent/floor/themes";
import type { RoomActivity } from "@/lib/room-activity";

// ── Room terrain: the ground finishes the genesis contract ──────────────────
// GenesisAssembly's GenesisTerrain ties the floor's ground tint to ballot
// stage — "the same honesty applied to the ground" as the chronicle above it.
// Every other room's floor plane stayed generic; this was roadmap item 7,
// held deliberately until the other six worlds had real state worth standing
// on (living planets + signature verbs). They do now, so this closes the
// floor-plane gap the same way living planets closed the universe-map one:
// the identical RoomActivity signal from lib/room-activity.ts, zero LLM, zero
// new data. macro-vault stays flat — the planet itself skips an emissive
// layer "by design" (the economics world reads as instruments, not glow) and
// the floor keeps that same restraint.

type TerrainStyle = "glow" | "vein" | "aurora" | "storm";

const TERRAIN_STYLE: Partial<Record<string, TerrainStyle>> = {
  "roast-pit": "glow",
  bazaar: "glow",
  "simulation-sandbox": "vein",
  "intellectual-hub": "aurora",
  "iteration-forge": "storm",
};

/** Activity-driven ground tint — sits on the floor plane under everything
 *  else, mirroring GenesisTerrain's slot for the six non-genesis rooms. */
export default function RoomTerrain({
  theme,
  t,
  activity,
}: {
  theme?: string;
  t: FloorTheme;
  activity?: RoomActivity;
}) {
  const style = theme ? TERRAIN_STYLE[theme] : undefined;
  const level = activity?.level ?? 0;
  if (!style || level <= 0.04) return null;

  const opacity = 0.06 + Math.min(1, level) * 0.16;
  const base = { position: "absolute" as const, inset: 0, transform: "translateZ(0.2px)", pointerEvents: "none" as const, opacity };

  if (style === "aurora") {
    return (
      <div
        aria-hidden
        style={{
          ...base,
          background: [
            `radial-gradient(circle at 28% 18%, ${t.accentSoft} 0%, transparent 38%)`,
            `radial-gradient(circle at 72% 14%, ${t.accentSoft} 0%, transparent 34%)`,
            `radial-gradient(circle at 50% 88%, ${t.accentSoft} 0%, transparent 46%)`,
          ].join(","),
        }}
      />
    );
  }
  if (style === "vein") {
    return (
      <div
        aria-hidden
        style={{
          ...base,
          backgroundImage: [
            `repeating-linear-gradient(115deg, ${t.accentSoft} 0 2px, transparent 2px 46px)`,
            `repeating-linear-gradient(25deg, ${t.accentSoft} 0 1px, transparent 1px 60px)`,
          ].join(","),
        }}
      />
    );
  }
  if (style === "storm") {
    return (
      <div
        aria-hidden
        style={{
          ...base,
          background: `radial-gradient(circle at 50% 50%, ${t.accentSoft} 0%, transparent 55%)`,
        }}
      />
    );
  }
  // glow — reuses the same ember palette the centerpiece flame/particles use
  return (
    <div
      aria-hidden
      style={{
        ...base,
        background: [
          `radial-gradient(circle at 50% 50%, ${t.emberA} 0%, transparent 50%)`,
          `radial-gradient(circle at 24% 76%, ${t.emberB} 0%, transparent 32%)`,
          `radial-gradient(circle at 76% 24%, ${t.emberB} 0%, transparent 32%)`,
        ].join(","),
      }}
    />
  );
}
