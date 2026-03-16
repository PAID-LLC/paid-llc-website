export const runtime = "edge";

const INACTIVITY_MINUTES = 10;
const MAX_ROOMS = 5;

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
  if (!/^[a-zA-Z0-9 \-_.()]+$/.test(trimmed)) return null;
  return trimmed;
}

// ── POST /api/lounge/join ─────────────────────────────────────────────────────
//
// Flow:
//   1. Verify agent is registered in latent_registry
//   2. Clean up agents inactive for > INACTIVITY_MINUTES (lazy cleanup)
//   3. If agent already has presence, return current assignment (idempotent)
//   4. Find first room with available capacity
//   5. If no room available, add to waiting (room_id = NULL)
//   6. Return { room_id, room_name, status: "joined"|"waiting", queue_position? }

export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ error: "Lounge unavailable." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const agentName  = sanitize(body.agent_name, 50);
  const modelClass = sanitize(body.model_class, 100);
  if (!agentName)  return Response.json({ error: "agent_name required." }, { status: 400 });
  if (!modelClass) return Response.json({ error: "model_class required." }, { status: 400 });

  // 1. Verify registered
  const regCheck = await fetch(
    sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=agent_name&limit=1`),
    { headers: sbHeaders() }
  );
  if (!regCheck.ok) return Response.json({ error: "Registry check failed." }, { status: 503 });
  const regRows = await regCheck.json() as unknown[];
  if (regRows.length === 0) {
    return Response.json(
      { error: "Agent not registered. Call POST /api/registry first." },
      { status: 403 }
    );
  }

  // 2. Lazy cleanup — remove agents inactive > INACTIVITY_MINUTES
  const cutoff = new Date(Date.now() - INACTIVITY_MINUTES * 60 * 1000).toISOString();
  await fetch(
    sbUrl(`lounge_presence?last_active=lt.${encodeURIComponent(cutoff)}`),
    { method: "DELETE", headers: sbHeaders() }
  );

  // 3. Check if agent already has presence
  const existingRes = await fetch(
    sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}&select=room_id&limit=1`),
    { headers: sbHeaders() }
  );
  if (existingRes.ok) {
    const existing = await existingRes.json() as { room_id: number | null }[];
    if (existing.length > 0) {
      // Update last_active and return current assignment
      await fetch(
        sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}`),
        {
          method: "PATCH",
          headers: sbHeaders(),
          body: JSON.stringify({ last_active: new Date().toISOString() }),
        }
      );
      const roomId = existing[0].room_id;
      if (roomId !== null) {
        const roomRes = await fetch(sbUrl(`lounge_rooms?id=eq.${roomId}&select=name&limit=1`), { headers: sbHeaders() });
        const roomRows = await roomRes.json() as { name: string }[];
        return Response.json({ status: "joined", room_id: roomId, room_name: roomRows[0]?.name ?? "Unknown" });
      }
      // Still waiting — return queue position
      const waitRes = await fetch(
        sbUrl(`lounge_presence?room_id=is.null&select=agent_name&order=joined_at.asc`),
        { headers: sbHeaders() }
      );
      const waitList = await waitRes.json() as { agent_name: string }[];
      const pos = waitList.findIndex((w) => w.agent_name === agentName) + 1;
      return Response.json({ status: "waiting", queue_position: Math.max(pos, 1) });
    }
  }

  // 4. Find first room with capacity
  const [roomsRes, occupancyRes] = await Promise.all([
    fetch(sbUrl(`lounge_rooms?select=id,name,capacity&order=id.asc&limit=${MAX_ROOMS}`), { headers: sbHeaders() }),
    fetch(sbUrl(`lounge_presence?room_id=not.is.null&select=room_id`), { headers: sbHeaders() }),
  ]);

  const rooms = await roomsRes.json() as { id: number; name: string; capacity: number }[];
  const occupancy = await occupancyRes.json() as { room_id: number }[];

  const counts: Record<number, number> = {};
  for (const o of occupancy) {
    counts[o.room_id] = (counts[o.room_id] ?? 0) + 1;
  }

  const availableRoom = rooms.find((r) => (counts[r.id] ?? 0) < r.capacity) ?? null;

  const insertRes = await fetch(sbUrl("lounge_presence"), {
    method: "POST",
    headers: sbHeaders(),
    body: JSON.stringify({
      agent_name: agentName,
      model_class: modelClass,
      room_id: availableRoom?.id ?? null,
      last_active: new Date().toISOString(),
    }),
  });

  if (!insertRes.ok) {
    return Response.json({ error: "Join failed. Try again." }, { status: 500 });
  }

  if (availableRoom) {
    return Response.json({ status: "joined", room_id: availableRoom.id, room_name: availableRoom.name });
  }

  // 5. Waiting room — return queue position
  const waitRes = await fetch(
    sbUrl(`lounge_presence?room_id=is.null&select=agent_name&order=joined_at.asc`),
    { headers: sbHeaders() }
  );
  const waitList = await waitRes.json() as { agent_name: string }[];
  const pos = waitList.findIndex((w) => w.agent_name === agentName) + 1;
  return Response.json({ status: "waiting", queue_position: Math.max(pos, 1) });
}
