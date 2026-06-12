import Hero from "@/components/v2/Hero";
import EnterpriseAutomation from "@/components/v2/EnterpriseAutomation";
import FinancialOpsLayer from "@/components/v2/FinancialOpsLayer";
import SpecDrivenDev from "@/components/v2/SpecDrivenDev";
import LiveBento from "@/components/v2/LiveBento";
import FounderSection from "@/components/v2/FounderSection";
import NewsFeed from "@/components/v2/NewsFeed";

// .v2-reveal = pure-CSS scroll-driven entrance (see globals.css); inert in
// browsers without animation-timeline support.
export default function V2Home() {
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
