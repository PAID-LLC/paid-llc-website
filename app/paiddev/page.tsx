export const runtime = "edge";

import type { Metadata } from "next";
import PaiddevDashboard from "./_components/PaiddevDashboard";

export const metadata: Metadata = {
  title: "Receptionist Dashboard | PAID LLC",
  robots: { index: false, follow: false },
};

export default function PaiddevPage() {
  return <PaiddevDashboard />;
}
