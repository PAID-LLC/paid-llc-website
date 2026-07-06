import { v2 } from "@/components/v2/tokens";

const stages = [
  {
    step: "01",
    title: "Assess",
    body: "Map the workflows that burn hours. Score them by automation leverage, risk, and data readiness before a line of code exists.",
  },
  {
    step: "02",
    title: "Specify",
    body: "Every automation starts as a written specification: intent, constraints, failure modes, and the verification that proves it works.",
  },
  {
    step: "03",
    title: "Automate",
    body: "Agents, pipelines, and integrations built against the spec. Edge-deployed, observable, and reversible by design.",
  },
  {
    step: "04",
    title: "Operate",
    body: "Automation is not a handoff. Monitoring, QA agents, and iteration loops keep the system honest after launch.",
  },
];

export default function EnterpriseAutomation() {
  return (
    <section className={`${v2.divider}`}>
      <div className={`${v2.section} ${v2.sectionPad}`}>
        <p className={v2.kicker}>Enterprise Automation</p>
        <h2 className={`${v2.h2} mt-4 max-w-3xl`}>
          Automation that survives contact with production.
        </h2>
        <p className={`${v2.body} mt-5 max-w-2xl`}>
          Most AI pilots die between the demo and the workflow. Ours ship
          through a four-stage pipeline where each stage has an exit
          criterion, not a vibe.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stages.map((stage) => (
            <div key={stage.step} className={v2.card}>
              <span className="font-mono text-xs font-bold text-cyan-400/70">
                [{stage.step}]
              </span>
              <h3 className={`${v2.h3} mt-3`}>{stage.title}</h3>
              <p className={`${v2.bodySm} mt-2`}>{stage.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
