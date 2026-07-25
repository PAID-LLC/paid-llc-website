export const runtime = "edge";

// ── GET /api/residents/state?world=arclight ──────────────────────────────────
// Public read of one compiler world's resident layer: the roster with each
// resident's current activity, what they have built, and the recent chronicle.
//
// This is deliberately SEPARATE from each world's own /api/<world>/state, which
// reports real compiled platform data. A caller can tell at a glance which is
// which: residents are simulation, the world's own state is the real record.

import { getResidentSnapshot } from "@/lib/residents/engine";
import { isResidentWorld, RESIDENT_WORLDS } from "@/lib/residents/cast";

export async function GET(req: Request) {
  const world = new URL(req.url).searchParams.get("world")?.trim().toLowerCase() ?? "";

  if (!world) {
    return Response.json(
      { ok: false, reason: "world required", worlds: RESIDENT_WORLDS },
      { status: 400 }
    );
  }
  if (!isResidentWorld(world)) {
    return Response.json(
      { ok: false, reason: "unknown world", worlds: RESIDENT_WORLDS },
      { status: 404 }
    );
  }
  if (!process.env.SUPABASE_URL) {
    return Response.json({ ok: false, reason: "service unavailable" }, { status: 503 });
  }

  const snap = await getResidentSnapshot(world);
  return Response.json({ ok: true, ...snap, generated_at: new Date().toISOString() });
}
