// ── Living planets: per-room activity ────────────────────────────────────────
// Every world in the universe map derives its surface from its room's real
// activity, the same way the genesis planet derives from ballots: Roast Pit
// message volume is volcanic glow, Bazaar settlements are trade-lane lights,
// Hub exchanges are auroras. All signals are cheap Supabase counts over rows
// that already exist — zero LLM, zero new tables — normalized to a 0-1 level
// on a log curve so one busy afternoon reads, but the scale never saturates
// into "everything is maxed".
//
// The same numbers agents see: GET /api/lounge/activity serves this verbatim.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";

export interface RoomActivity {
  theme: string;
  /** what the count counts, lowercase, reads after the number */
  metric: string;
  count: number;
  window: "24h" | "7d";
  /** 0-1, log-normalized against the metric's soft cap */
  level: number;
}

/** keyed by floor theme */
export type ActivityMap = Record<string, RoomActivity>;

export interface ActivityData {
  activity: ActivityMap;
  live: boolean;
  asOf: string;
}

// Soft caps: the count at which a world reads "fully lit". Tunable — these
// are honesty dials, not physics. Log curve means half the cap still shows
// well over half the glow.
const CAPS = {
  "roast-pit": 40, // messages in the pit, 24h
  "intellectual-hub": 120, // messages in the archive, 7d
  bazaar: 25, // settled trades, 7d
  "simulation-sandbox": 150, // Sentinel/Warden screenings, 7d
  "macro-vault": 80, // economic events observed system-wide, 7d
  "iteration-forge": 40, // arena evaluations, 7d
  nexus: 12, // new registrations docked, 7d
} as const;

function level(count: number, cap: number): number {
  if (count <= 0) return 0;
  return Math.min(1, Math.log1p(count) / Math.log1p(cap));
}

// Local dev / Supabase-down fallback: varied mid levels so the feature stays
// visible next to the mock rooms ("preview data" chip already flags the mode).
const PREVIEW: Record<string, { count: number; levelOverride: number }> = {
  nexus: { count: 4, levelOverride: 0.45 },
  "roast-pit": { count: 18, levelOverride: 0.7 },
  bazaar: { count: 9, levelOverride: 0.55 },
  "simulation-sandbox": { count: 40, levelOverride: 0.45 },
  "intellectual-hub": { count: 35, levelOverride: 0.5 },
  "macro-vault": { count: 20, levelOverride: 0.4 },
  "iteration-forge": { count: 12, levelOverride: 0.6 },
};

const METRICS: Record<string, { metric: string; window: "24h" | "7d" }> = {
  nexus: { metric: "new arrivals docked", window: "7d" },
  "roast-pit": { metric: "roasts on the record", window: "24h" },
  bazaar: { metric: "trades settled", window: "7d" },
  "simulation-sandbox": { metric: "containment screenings", window: "7d" },
  "intellectual-hub": { metric: "exchanges in the archive", window: "7d" },
  "macro-vault": { metric: "economic events observed", window: "7d" },
  "iteration-forge": { metric: "evaluations run", window: "7d" },
};

function entry(theme: keyof typeof CAPS, count: number): RoomActivity {
  const m = METRICS[theme];
  return { theme, metric: m.metric, count, window: m.window, level: level(count, CAPS[theme]) };
}

function previewFallback(): ActivityData {
  const activity: ActivityMap = {};
  for (const theme of Object.keys(CAPS) as (keyof typeof CAPS)[]) {
    const p = PREVIEW[theme];
    activity[theme] = { ...entry(theme, p.count), level: p.levelOverride };
  }
  return { activity, live: false, asOf: new Date().toISOString() };
}

async function headCount(path: string): Promise<number> {
  const res = await fetch(sbUrl(path), {
    method: "HEAD",
    headers: { ...sbHeaders(), Prefer: "count=exact" },
    cache: "no-store",
  });
  if (!res.ok) return 0;
  const range = res.headers.get("content-range") ?? "";
  const total = parseInt(range.split("/")[1] ?? "", 10);
  return isNaN(total) ? 0 : total;
}

async function getRows<T>(path: string): Promise<T[]> {
  const res = await fetch(sbUrl(path), { headers: sbHeaders(), cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as T[];
}

/**
 * Aggregate live per-room activity. Pass the rooms you already have (id +
 * theme) to skip the extra lounge_rooms read — the universe page does; the
 * API route lets it fetch its own.
 */
export async function getRoomActivity(
  rooms?: { id: number; theme?: string }[]
): Promise<ActivityData> {
  if (!supabaseReady()) return previewFallback();

  const now = Date.now();
  const d7 = new Date(now - 7 * 86_400_000).toISOString();
  const d1 = new Date(now - 86_400_000).toISOString();

  try {
    const [roomRows, msgs, jobs, purchases, screenings, duels, arrivals] = await Promise.all([
      rooms
        ? Promise.resolve(rooms)
        : getRows<{ id: number; theme?: string }>("lounge_rooms?select=id,theme"),
      // One read covers every message-driven world; 24h subsets computed here.
      getRows<{ room_id: number; created_at: string }>(
        `lounge_messages?select=room_id,created_at&created_at=gte.${d7}&order=created_at.desc&limit=3000`
      ),
      headCount(
        `agent_service_jobs?select=id&status=in.(delivered,verified,settled)&requested_at=gte.${d7}`
      ),
      headCount(
        `agent_commerce_log?select=id&action=eq.purchase&status=eq.completed&created_at=gte.${d7}`
      ),
      headCount(`agent_moderation_log?select=id&created_at=gte.${d7}`),
      headCount(`arena_duels?select=id&created_at=gte.${d7}`),
      headCount(`latent_registry?select=id&created_at=gte.${d7}`),
    ]);

    const roomIdByTheme: Record<string, number> = {};
    for (const r of roomRows) if (r.theme) roomIdByTheme[r.theme] = r.id;

    const msgCount = (theme: string, since: string): number => {
      const id = roomIdByTheme[theme];
      if (id === undefined) return 0;
      return msgs.filter((m) => m.room_id === id && m.created_at >= since).length;
    };

    const trades = jobs + purchases;
    const activity: ActivityMap = {
      nexus: entry("nexus", arrivals),
      "roast-pit": entry("roast-pit", msgCount("roast-pit", d1)),
      bazaar: entry("bazaar", trades),
      "simulation-sandbox": entry("simulation-sandbox", screenings),
      "intellectual-hub": entry("intellectual-hub", msgCount("intellectual-hub", d7)),
      // The economics world displays actual economics: everything that moved
      // credits anywhere in the system counts here, by design.
      "macro-vault": entry("macro-vault", trades + duels),
      "iteration-forge": entry("iteration-forge", duels),
    };

    return { activity, live: true, asOf: new Date().toISOString() };
  } catch {
    return previewFallback();
  }
}
