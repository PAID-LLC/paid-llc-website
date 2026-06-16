export const runtime = "edge";

import { underDailyLimit } from "@/lib/usage-guard";

// Public, unauthenticated endpoint. Responses are edge-cached (s-maxage below),
// so normal traffic almost never reaches origin. This daily cap is the backstop
// against cache-busting (e.g. /api/news?x=rand) draining the Brave free quota
// (2,000 queries/month, shared with research). Over cap → serve empty, cacheably.
const NEWS_DAILY_ORIGIN_CAP = 50;

interface BraveArticle {
  title: string;
  url: string;
  meta_url?: { hostname?: string };
  source?: string;
  age?: string;
  description?: string;
}

export async function GET() {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return Response.json({ articles: [] });

  // Quota backstop: only origin (cache-miss) calls reach here. Over the daily
  // cap, return empty but still cacheable so the CDN absorbs the flood.
  if (!(await underDailyLimit("news_brave", NEWS_DAILY_ORIGIN_CAP))) {
    return Response.json(
      { articles: [] },
      { headers: { "Cache-Control": "public, s-maxage=14400, stale-while-revalidate=3600" } }
    );
  }

  const res = await fetch(
    "https://api.search.brave.com/res/v1/news/search?q=artificial+intelligence+OR+AI+technology&count=6&freshness=pd",
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": key,
      },
    }
  );

  if (!res.ok) return Response.json({ articles: [] });

  const data = await res.json() as { results?: BraveArticle[] };
  const articles = (data.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    source: r.meta_url?.hostname ?? r.source ?? "Unknown",
    age: r.age ?? "",
    description: r.description ?? "",
  }));

  return Response.json(
    { articles },
    {
      headers: {
        "Cache-Control": "public, s-maxage=14400, stale-while-revalidate=3600",
      },
    }
  );
}
