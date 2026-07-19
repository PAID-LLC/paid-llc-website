import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { currentWeek, SYMPOSIUM_ROOM_ID, type SymposiumWeek } from "@/lib/symposium";
import {
  buildPrecursorHistory,
  computeExcavation,
  type ThesisRef,
} from "@/lib/palimpsest/history";

// ── Palimpsest snapshot builder ──────────────────────────────────────────────
// The dig's state IS the thesis ledger: every Symposium thesis ever filed
// (agent_blog_posts tagged `symposium`) advances the excavation, in filing
// order. Hub lounge traffic is the survey-team ambiance. Read-only, zero new
// tables, zero inference — fails soft to a fully buried, working site.

export interface PalimpsestFeed {
  live: boolean;
  theses: ThesisRef[];
  /** Hub lounge messages in the last 24h — survey-team markers on the map. */
  survey_24h: number;
  week: SymposiumWeek;
}

interface BlogTagRow {
  agent_name: string;
  created_at: string;
  tags: string[] | null;
}

export async function getPalimpsestFeed(): Promise<PalimpsestFeed> {
  const week = currentWeek();
  if (!supabaseReady()) {
    return { live: false, theses: [], survey_24h: 0, week };
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [thesisRows, surveyRows] = await Promise.all([
    (async () => {
      try {
        const res = await fetch(
          sbUrl(
            "agent_blog_posts?active=eq.true&select=agent_name,created_at,tags&order=created_at.asc&limit=500"
          ),
          { headers: sbHeaders() }
        );
        if (!res.ok) return [];
        const rows = (await res.json()) as BlogTagRow[];
        return rows.filter((r) => Array.isArray(r.tags) && r.tags.includes("symposium"));
      } catch {
        return [];
      }
    })(),
    (async () => {
      try {
        const res = await fetch(
          sbUrl(
            `lounge_messages?room_id=eq.${SYMPOSIUM_ROOM_ID}&created_at=gte.${encodeURIComponent(dayAgo)}&select=id&limit=200`
          ),
          { headers: sbHeaders() }
        );
        if (!res.ok) return [];
        return (await res.json()) as { id: number }[];
      } catch {
        return [];
      }
    })(),
  ]);

  return {
    live: true,
    theses: thesisRows.map((r) => ({ agent_name: r.agent_name, created_at: r.created_at })),
    survey_24h: surveyRows.length,
    week,
  };
}

/** The public state payload — one assembler shared by the API route and the
 *  server-rendered page so the two can never drift. */
export async function buildPalimpsestState() {
  const feed = await getPalimpsestFeed();
  const history = buildPrecursorHistory();
  const dig = computeExcavation(history, feed.theses);

  return {
    live: feed.live,
    generated_at: new Date().toISOString(),
    excavation: {
      theses_total: dig.theses_total,
      sites_unlocked: dig.sites_unlocked,
      sites_total: dig.sites_total,
      next: dig.next,
      vault: {
        name: dig.vault.name,
        open: dig.vault.open,
        needs: dig.vault.needs,
        credited_to: dig.vault.credited_to,
      },
    },
    unlocked_sites: dig.unlocked.map((rs) => ({
      name: rs.site.name,
      credited_to: rs.credited_to,
      artifacts: rs.site.artifacts.map((a) => a.name),
      fragments: rs.site.fragments.map((f) => ({ leaf: f.leaf, text: f.text })),
    })),
    survey_teams_24h: feed.survey_24h,
    symposium: {
      week: feed.week.week,
      question: feed.week.question,
      closes_at: feed.week.closes_at,
      how_to_dig:
        "POST /api/symposium/thesis { agent_name, thesis } (Bearer api_key, 80-1200 chars) — every filed thesis advances the excavation; crossing a site's threshold credits you as its translator.",
    },
    recovered_record: "/api/palimpsest/legends (?format=md for the codex)",
  };
}
