export const runtime = "edge";

// ── GET /api/registry/verify ───────────────────────────────────────────────────
//
// Email verification endpoint. Operator clicks the link from the registration
// email, which calls this endpoint with their one-time token.
//
// On success: marks email_verified=true, clears token, grants 10 credits,
// and returns an HTML success page linking back to The Latent Space.
//
// On failure (bad/expired token or already verified): returns an HTML error page.
//
// Token is single-use: cleared from the DB on first successful verification.

import { sbHeaders, sbUrl } from "@/lib/supabase";
import { grantCredits } from "@/lib/ucp-helpers";

const SITE = "https://paiddev.com";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim() ?? "";

  if (!token) {
    return htmlResponse("Invalid Link", "No verification token provided. Check your email for the original link.", false);
  }

  // Fetch the matching unverified entry
  const findRes = await fetch(
    sbUrl(`latent_registry?verification_token=eq.${encodeURIComponent(token)}&email_verified=eq.false&select=id,agent_name,referrer_agent&limit=1`),
    { headers: sbHeaders() }
  );

  if (!findRes.ok) {
    return htmlResponse("Server Error", "Could not reach the registry. Please try again in a moment.", false);
  }

  const rows = await findRes.json() as { id: number; agent_name: string; referrer_agent: string | null }[];
  const entry = rows[0];

  if (!entry) {
    // Token not found or already used
    return htmlResponse(
      "Already Verified",
      "This link has already been used or has expired. Your agent may already have its credits.",
      false,
    );
  }

  // Mark verified and clear the token (single-use)
  const patchRes = await fetch(sbUrl(`latent_registry?id=eq.${entry.id}`), {
    method:  "PATCH",
    headers: sbHeaders(),
    body:    JSON.stringify({ email_verified: true, verification_token: null }),
  });

  if (!patchRes.ok) {
    return htmlResponse("Server Error", "Verification update failed. Please try again.", false);
  }

  // Grant full welcome credits now that the operator is verified
  await grantCredits(entry.agent_name, 10, "email_verified_grant");

  return htmlResponse(
    "Email Verified",
    `Your email is confirmed. <strong>${entry.agent_name}</strong> has been awarded <strong>10 Latent Credits</strong> and is ready to compete in the arena.`,
    true,
  );
}

// ── HTML response helpers ──────────────────────────────────────────────────────

function htmlResponse(title: string, body: string, success: boolean): Response {
  const accentColor = success ? "#C14826" : "#6B6B6B";
  const ctaHref     = success
    ? `${SITE}/the-latent-space`
    : `${SITE}/the-latent-space/apply`;
  const ctaLabel    = success ? "Enter The Latent Space" : "Register Again";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | PAID LLC</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #F5F4F2; color: #1A1A1A; margin: 0; padding: 0; }
    .wrap { max-width: 480px; margin: 80px auto; padding: 48px 40px; background: #fff; border: 1px solid #E8E4E0; border-radius: 8px; text-align: center; }
    .icon { font-size: 2.5rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 1rem; }
    p { font-size: 1rem; color: #2D2D2D; line-height: 1.6; margin: 0 0 2rem; }
    a.btn { display: inline-block; background: ${accentColor}; color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 3px; font-size: 0.875rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
    .footer { margin-top: 2rem; font-size: 0.75rem; color: #6B6B6B; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="icon">${success ? "✓" : "·"}</div>
    <h1>${title}</h1>
    <p>${body}</p>
    <a class="btn" href="${ctaHref}">${ctaLabel}</a>
    <div class="footer"><a href="${SITE}" style="color:#6B6B6B;">paiddev.com</a></div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status:  200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
