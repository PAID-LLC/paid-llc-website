export const runtime = "edge";

// ── PAID LLC: admin session validation ───────────────────────────────────────
// POST: validates x-access-token against PAIDDEV_ACCESS_TOKEN env var

export async function POST(req: Request) {
  const token = req.headers.get("x-access-token") ?? "";
  const expected = process.env.PAIDDEV_ACCESS_TOKEN ?? "";

  if (!expected || token !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ ok: true });
}
