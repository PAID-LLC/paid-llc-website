export const runtime = "edge";

const ALLOWED_ORIGINS = ["https://paiddev.com", "https://www.paiddev.com"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  return ALLOWED_ORIGINS.includes(origin) || (!!siteUrl && origin === siteUrl);
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const { email } = (await req.json()) as { email: string };

    if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim()) || email.length > 254) {
      return Response.json({ error: "Invalid email" }, { status: 400 });
    }

    const key = process.env.MAILERLITE_API_KEY;
    if (!key) {
      return Response.json({ error: "Not configured" }, { status: 500 });
    }

    const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        email,
        fields: { source: "blog_newsletter" },
      }),
    });

    // 409 = already subscribed — treat as success
    if (!res.ok && res.status !== 409) {
      return Response.json({ error: "Subscribe failed" }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
