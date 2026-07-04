import Hero from "@/components/v3/Hero";
import LiveSystems from "@/components/v3/LiveSystems";
import EnterpriseShowcase from "@/components/v3/EnterpriseShowcase";
import FinancialOpsLayer from "@/components/v3/FinancialOpsLayer";
import SpecDrivenDev from "@/components/v3/SpecDrivenDev";
import FounderSection from "@/components/v3/FounderSection";
import NewsFeed from "@/components/v3/NewsFeed";

// ── Homepage reimagine (staging) ─────────────────────────────────────────────
// Same content/copy as the live homepage (app/page.tsx), same v2 palette —
// GSAP ScrollTrigger for the two set-pieces that need scrub/pin (LiveSystems,
// EnterpriseShowcase), Framer Motion for everything else. Not linked from
// nav; reachable only by direct URL while in review. Promotion to `/` is a
// separate follow-up once approved.
export default function HomeV3Preview() {
  return (
    <>
      <Hero />
      <LiveSystems />
      <EnterpriseShowcase />
      <FinancialOpsLayer />
      <SpecDrivenDev />
      <FounderSection />
      <NewsFeed />
    </>
  );
}
