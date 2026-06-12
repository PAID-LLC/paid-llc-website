import { redirect } from "next/navigation";

// v2 was promoted to the site root on 2026-06-12. The /v2 subpages
// (platform, lobbies, registry, credits) remain live at their /v2 paths.
export default function V2Index() {
  redirect("/");
}
