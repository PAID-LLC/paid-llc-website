import { sbHeaders, sbUrl } from "@/lib/supabase";

// ── Canned reply bank ────────────────────────────────────────────────────────
// Fallback layer between Gemini and the tiny in-code ACTION_POOLS: ~80 hand-
// written lines per home agent in Supabase canned_replies (seed:
// db/canned-replies.sql). Selection is least-recently-used with topic
// matching, so a line cannot repeat until most of its agent's pool has
// cycled. FAIL OPEN: missing table or outage returns null and callers fall
// through to ACTION_POOLS.

const POOL_WINDOW = 12; // randomize among the N least-recently-used candidates

// Common words that carry no topic signal — skipped during tag matching.
const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "your", "yours", "all",
  "can", "could", "would", "should", "has", "have", "had", "was", "were",
  "this", "that", "these", "those", "with", "without", "from", "into",
  "about", "what", "when", "where", "which", "who", "whom", "how", "why",
  "does", "did", "doing", "been", "being", "will", "wont", "dont", "cant",
  "just", "like", "than", "then", "them", "they", "their", "there", "here",
  "very", "really", "some", "any", "out", "get", "got", "its", "let", "lets",
  "tell", "say", "said", "know", "want", "make", "made", "one", "two",
]);

interface CannedRow {
  id:      number;
  content: string;
}

/** Extract up to 8 topic words from a human message for tag matching. */
function topicWords(text: string): string[] {
  return Array.from(new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && w.length <= 20 && !STOPWORDS.has(w))
  )).slice(0, 8);
}

/**
 * Pick a canned reply for `agentName`, preferring lines whose tags overlap
 * the visitor's message. Marks the chosen line used so it rotates to the
 * back of the queue. Returns null when no bank exists (caller falls back).
 */
export async function pickCannedReply(agentName: string, humanText: string): Promise<string | null> {
  if (!process.env.SUPABASE_URL) return null;
  try {
    const base =
      `canned_replies?agent_name=eq.${encodeURIComponent(agentName)}` +
      `&select=id,content&order=last_used_at.asc.nullsfirst`;

    // Pass 1: topic-matched candidates (PostgREST array overlap on tags)
    let rows: CannedRow[] = [];
    const words = topicWords(humanText);
    if (words.length > 0) {
      const res = await fetch(
        sbUrl(`${base}&tags=ov.{${words.join(",")}}&limit=${POOL_WINDOW}`),
        { headers: sbHeaders() }
      );
      if (res.ok) rows = await res.json() as CannedRow[];
    }

    // Pass 2: no topic match — least-recently-used from the full pool
    if (rows.length === 0) {
      const res = await fetch(sbUrl(`${base}&limit=${POOL_WINDOW}`), { headers: sbHeaders() });
      if (!res.ok) return null;
      rows = await res.json() as CannedRow[];
    }
    if (rows.length === 0) return null;

    const pick = rows[Math.floor(Math.random() * rows.length)];

    // Rotate to the back of the queue — awaited (edge kills fire-and-forget).
    await fetch(sbUrl(`canned_replies?id=eq.${pick.id}`), {
      method:  "PATCH",
      headers: sbHeaders(),
      body:    JSON.stringify({ last_used_at: new Date().toISOString() }),
    });

    return pick.content;
  } catch {
    return null;
  }
}
