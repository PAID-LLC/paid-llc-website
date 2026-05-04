export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email: string };

    if (!email || !email.includes("@")) {
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
