export const runtime = "edge";

// POST /api/blog/[slug]/view  — increment view count, returns { views: N }
// GET  /api/blog/[slug]/view  — fetch current view count, returns { views: N }
// Used by ViewTracker client component and queryable by AI agents.

async function supabase(path: string, options: RequestInit = {}) {
  const url  = process.env.SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug) return Response.json({ error: "slug required" }, { status: 400 });

  const res = await supabase("/rest/v1/rpc/increment_blog_view", {
    method: "POST",
    body: JSON.stringify({ p_slug: slug }),
  });

  const views: number = res?.ok ? (await res.json() as number) : 0;
  return Response.json({ views }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug) return Response.json({ error: "slug required" }, { status: 400 });

  const res = await supabase(
    `/rest/v1/blog_views?slug=eq.${encodeURIComponent(slug)}&select=views`
  );

  const rows = res?.ok ? (await res.json() as { views: number }[]) : [];
  const views = rows[0]?.views ?? 0;
  return Response.json({ views }, { headers: { "Cache-Control": "no-store" } });
}
