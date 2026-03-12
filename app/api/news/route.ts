export const runtime = "edge";

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

  const res = await fetch(
    "https://api.search.brave.com/res/v1/news/search?q=artificial+intelligence+business&count=6&freshness=pd",
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
