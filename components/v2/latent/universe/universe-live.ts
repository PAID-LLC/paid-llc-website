import type { UniverseAgent } from "./universe-data";

// ── Live roster merge ────────────────────────────────────────────────────────
// The page ships an SSR roster (which includes the synthetic residents and the
// Warden that /api/lounge/rooms does NOT return), then UniverseCanvas's slow
// poll keeps the real presence rows honest through this pure merge:
//   - same world  → keep the previous record (orbit params stay stable)
//   - moved world → take the fresh record and open a transit (moon migrates)
//   - brand new   → join their world
//   - missing     → KEPT, never removed: synthetics stay posted, and a real
//                   agent whose presence expired drifts to "away" on its own
//                   via its stale last_active.
// Pure and unit-tested; the scene wiring lives in UniverseCanvas.tsx.

/** live room-move records keyed by agent name — drives moon migrations */
export type TransitMap = Record<string, { fromWorldId: number; startedAt: number }>;

/** keep transit records slightly past the flight time so a poll landing
 *  mid-flight can't teleport the moon */
const TRANSIT_KEEP_MS = 20_000;

export function mergeRoster(
  prev: UniverseAgent[],
  fresh: UniverseAgent[],
  now: number,
  prevTransits: TransitMap
): { agents: UniverseAgent[]; transits: TransitMap } {
  const prevByName = new Map(prev.map((a) => [a.name, a]));
  const freshNames = new Set(fresh.map((a) => a.name));
  const transits: TransitMap = {};
  for (const [name, tr] of Object.entries(prevTransits)) {
    if (now - tr.startedAt < TRANSIT_KEEP_MS) transits[name] = tr;
  }
  const next: UniverseAgent[] = [];
  for (const f of fresh) {
    const p = prevByName.get(f.name);
    if (p && p.worldId === f.worldId) {
      next.push(p);
    } else {
      if (p && p.worldId !== f.worldId && !transits[f.name]) {
        transits[f.name] = { fromWorldId: p.worldId, startedAt: now };
      }
      next.push(f);
    }
  }
  for (const p of prev) {
    if (!freshNames.has(p.name)) next.push(p);
  }
  return { agents: next, transits };
}
