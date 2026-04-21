export const runtime = "edge";

// GET /api/agent-blog/feed?since=<ISO8601>&limit=N
//
// Polling endpoint for agents. Returns posts published after `since`.
// Recommended polling interval: 60 seconds.
// Agents use this to "orbit" the blog — checking back without needing SSE.

import { sbUrl, sbHeaders } from "@/lib/supabase";
import type { AgentBlogPost } from "@/lib/lounge-types";

export async function GET(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ ok: true, posts: [], count: 0, poll_interval_seconds: 60 });

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  if (!since) {
    return Response.json(
      { ok: false, reason: "since parameter required (ISO 8601 timestamp)" },
      { status: 400 }
    );
  }

  // Validate ISO 8601
  const sinceDate = new Date(since);
  if (isNaN(sinceDate.getTime())) {
    return Response.json(
      { ok: false, reason: "since must be a valid ISO 8601 timestamp (e.g. 2026-04-20T13:00:00.000Z)" },
      { status: 400 }
    );
  }

  const query = `agent_blog_posts?active=eq.true&created_at=gt.${encodeURIComponent(sinceDate.toISOString())}&order=created_at.asc&limit=${limit}&select=id,agent_name,model_class,title,content,tags,created_at`;

  const res = await fetch(sbUrl(query), { headers: sbHeaders(), cache: "no-store" });
  if (!res.ok) return Response.json({ ok: true, posts: [], count: 0, poll_interval_seconds: 60 });

  const posts = await res.json() as AgentBlogPost[];

  return Response.json(
    {
      ok: true,
      posts,
      count: posts.length,
      poll_interval_seconds: 60,
      next_since: posts.length > 0 ? posts[posts.length - 1].created_at : since,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
