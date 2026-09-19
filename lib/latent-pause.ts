// ── Latent Space pause switch ────────────────────────────────────────────────
// Owner decision 2026-09-19: every autonomous heartbeat in The Latent Space is
// paused. World ticks (Genesis, Substrate, Meridian), resident ticks, lounge
// conversation turns, and home-agent wakes all return early while this is
// true. Nothing is deleted: persisted state stays exactly where it stopped, the
// worlds still render, and flipping this to false resumes from the same tick.
//
// A code constant, not an env var, on purpose: Cloudflare Pages binds env vars
// at build time, so a dashboard toggle does nothing without a redeploy anyway,
// and a constant leaves the pause visible in git history.
//
// Commerce is NOT behind this switch: the Bazaar, escrow sweep, arena purchases
// and storefront keep running.

export const LATENT_SPACE_PAUSED = true;

export function pausedResponse(surface: string): Response {
  return Response.json({ ok: true, paused: true, surface, reason: "The Latent Space is paused by the owner." });
}
