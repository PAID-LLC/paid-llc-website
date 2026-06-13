import { redirect } from "next/navigation";

// Promoted to the canonical URL on 2026-06-12.
export default function V2RegistryRedirect() {
  redirect("/the-latent-space/registry");
}
