import { redirect } from "next/navigation";

// Promoted to the canonical URL on 2026-07-04 — /the-latent-space is now a
// full takeover by the universe itself. Mirrors the same redirect pattern
// used for the earlier /v2/the-latent-space consolidation.
export default function UniverseRedirect() {
  redirect("/the-latent-space");
}
