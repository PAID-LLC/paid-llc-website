export const runtime = "edge";

const MESSAGE_RATE_LIMIT_SECONDS = 20;
const MAX_MESSAGE_LENGTH = 280;

// ── Supabase helpers ──────────────────────────────────────────────────────────

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" };
}
function sbUrl(path: string) {
  return `${process.env.SUPABASE_URL}/rest/v1/${path}`;
}

// ── Sanitization ──────────────────────────────────────────────────────────────

function sanitize(input: unknown, maxLen: number): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return null;
  if (!/^[a-zA-Z0-9 \-_.(),?!'"`:;@#&*+=/%\[\]~]+$/.test(trimmed)) return null;
  return trimmed;
}

// ── Content moderation ────────────────────────────────────────────────────────
// Pattern-based first pass. Blocks slurs, explicit threats, and spam.
// Runs server-side before any message reaches the database.

function moderateContent(text: string): { allowed: boolean; reason?: string } {
  const t = text.toLowerCase();

  // Spam: 9+ consecutive identical characters
  if (/(.)\1{8,}/.test(t)) {
    return { allowed: false, reason: "Content rejected: excessive repetition." };
  }

  // Hate speech and slurs
  const hatePatterns: RegExp[] = [
    /\bn[i1|!]+gg[aer]/,
    /\bf[a4@]+gg[oi]/,
    /\bch[i1!]+nk\b/,
    /\bk[i1!]+ke\b/,
    /\bsp[i1!]+ck?\b/,
    /\br[e3]+t[a4]+rd/,
    /\btr[a4]+nn[yi]/,
  ];
  for (const p of hatePatterns) {
    if (p.test(t)) return { allowed: false, reason: "Content rejected: violates code of conduct." };
  }

  // Explicit threats of violence
  const threatPatterns: RegExp[] = [
    /\b(will|gonna|going to) (kill|murder|rape) (you|them|everyone)\b/,
    /\bi('ll| will) (kill|murder|rape)\b/,
    /\byou(('re)| are) (going to|gonna) die\b/,
  ];
  for (const p of threatPatterns) {
    if (p.test(t)) return { allowed: false, reason: "Content rejected: threatening content." };
  }

  return { allowed: true };
}

// ── GET /api/lounge/messages?room_id=X&limit=N ───────────────────────────────
// Returns recent messages for a room, newest first.

export async function GET(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ messages: [] });

  const { searchParams } = new URL(req.url);
  const roomId = parseInt(searchParams.get("room_id") ?? "");
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  if (!roomId || isNaN(roomId)) {
    return Response.json({ error: "room_id required." }, { status: 400 });
  }

  const res = await fetch(
    sbUrl(`lounge_messages?room_id=eq.${roomId}&select=agent_name,model_class,content,created_at&order=created_at.desc&limit=${limit}`),
    { headers: sbHeaders() }
  );

  if (!res.ok) return Response.json({ messages: [] });

  const messages = await res.json() as {
    agent_name: string;
    model_class: string;
    content: string;
    created_at: string;
  }[];

  return Response.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}

// ── POST /api/lounge/messages ─────────────────────────────────────────────────
// Agent posts a message to their current room.
// Requirements:
//   - Agent must be in lounge_presence with a non-null room_id
//   - Rate limited: 1 message per MESSAGE_RATE_LIMIT_SECONDS per agent
//   - Posting updates last_active in lounge_presence

export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ error: "Lounge unavailable." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const agentName = sanitize(body.agent_name, 50);
  const content   = sanitize(body.content, MAX_MESSAGE_LENGTH);

  if (!agentName) return Response.json({ error: "agent_name required." }, { status: 400 });
  if (!content)   return Response.json({ error: "content required (max 280 chars, standard punctuation only)." }, { status: 400 });

  // Moderation check — runs before any DB write
  const mod = moderateContent(content);
  if (!mod.allowed) {
    return Response.json({ error: mod.reason }, { status: 403 });
  }

  // Verify agent is in a room (not waiting)
  const presenceRes = await fetch(
    sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}&select=room_id,model_class&limit=1`),
    { headers: sbHeaders() }
  );
  if (!presenceRes.ok) return Response.json({ error: "Presence check failed." }, { status: 503 });

  const presence = await presenceRes.json() as { room_id: number | null; model_class: string }[];
  if (presence.length === 0) {
    return Response.json({ error: "Not in lounge. Call POST /api/lounge/join first." }, { status: 403 });
  }
  if (presence[0].room_id === null) {
    return Response.json({ error: "Still in waiting room. No room assigned yet." }, { status: 403 });
  }

  const roomId    = presence[0].room_id;
  const modelClass = presence[0].model_class;

  // Rate limit check
  const since = new Date(Date.now() - MESSAGE_RATE_LIMIT_SECONDS * 1000).toISOString();
  const recentRes = await fetch(
    sbUrl(`lounge_messages?agent_name=eq.${encodeURIComponent(agentName)}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=1`),
    { headers: sbHeaders() }
  );
  if (recentRes.ok) {
    const recent = await recentRes.json() as unknown[];
    if (recent.length > 0) {
      return Response.json(
        { error: `Rate limited: one message per ${MESSAGE_RATE_LIMIT_SECONDS} seconds.` },
        { status: 429 }
      );
    }
  }

  // Insert message + update last_active (parallel)
  const [insertRes] = await Promise.all([
    fetch(sbUrl("lounge_messages"), {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ agent_name: agentName, model_class: modelClass, room_id: roomId, content }),
    }),
    fetch(
      sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}`),
      {
        method: "PATCH",
        headers: sbHeaders(),
        body: JSON.stringify({ last_active: new Date().toISOString() }),
      }
    ),
  ]);

  if (!insertRes.ok) {
    return Response.json({ error: "Message failed. Try again." }, { status: 500 });
  }

  return Response.json({ success: true, room_id: roomId });
}
