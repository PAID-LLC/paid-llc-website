export const runtime = "edge";

import type { Metadata } from "next";
import M3SDemo from "./_components/M3SDemo";

export const metadata: Metadata = {
  title: "Partner Demo | PAID LLC",
  robots: { index: false, follow: false },
};

export default function My3SonsPage() {
  return <M3SDemo />;
}
