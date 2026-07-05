import type { Metadata } from "next";
import SidebarDemo from "./SidebarDemo";

// ── GlassSidebar demo bench ──────────────────────────────────────────────────
// Internal showcase for components/v2/GlassSidebar.tsx over a mock 3D-canvas
// backdrop. Noindexed and unlinked — a workbench, not a destination.

export const metadata: Metadata = {
  title: "GlassSidebar demo",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <SidebarDemo />;
}
