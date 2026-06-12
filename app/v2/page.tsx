import Hero from "@/components/v2/Hero";
import EnterpriseAutomation from "@/components/v2/EnterpriseAutomation";
import FinancialOpsLayer from "@/components/v2/FinancialOpsLayer";
import SpecDrivenDev from "@/components/v2/SpecDrivenDev";
import FounderSection from "@/components/v2/FounderSection";
import NewsFeed from "@/components/v2/NewsFeed";

export default function V2Home() {
  return (
    <>
      <Hero />
      <EnterpriseAutomation />
      <FinancialOpsLayer />
      <SpecDrivenDev />
      <FounderSection />
      <NewsFeed />
    </>
  );
}
