import Hero from "@/components/v2/Hero";
import EnterpriseAutomation from "@/components/v2/EnterpriseAutomation";
import FinancialOpsLayer from "@/components/v2/FinancialOpsLayer";
import SpecDrivenDev from "@/components/v2/SpecDrivenDev";
import LiveBento from "@/components/v2/LiveBento";
import FounderSection from "@/components/v2/FounderSection";
import NewsFeed from "@/components/v2/NewsFeed";

// ── Root homepage = the promoted v2 design (2026-06-12) ─────────────────────
// The v1 homepage is archived in the cowork repo (archives/v1-site/) and in
// git history. SiteChrome wraps this in V2Frame. /v2 redirects here.
export default function Home() {
  return (
    <>
      <Hero />
      <div className="v2-reveal"><EnterpriseAutomation /></div>
      <div className="v2-reveal"><FinancialOpsLayer /></div>
      <div className="v2-reveal"><SpecDrivenDev /></div>
      <div className="v2-reveal"><LiveBento /></div>
      <div className="v2-reveal"><FounderSection /></div>
      <div className="v2-reveal"><NewsFeed /></div>
    </>
  );
}
