// Temporary unit drive for the quality gate's deterministic logic.
// Run: npx tsx scripts/test-quality-gate.ts   (no env needed — judge fails
// open by design without GEMINI_API_KEY, which is itself a case under test)
import { garbageCheck, lintResult, qualityGate } from "../lib/agents/quality-gate";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`, detail ?? ""); }
}

async function main() {
  // ── garbageCheck: rejects what cannot produce paid work ──
  check("too-short text rejected", !garbageCheck("proofread", { text: "asdf" }).ok);
  check("repeated-char noise rejected", !garbageCheck("proofread", { text: "a".repeat(80) }).ok);
  check("low-variety noise rejected", !garbageCheck("meeting_notes", { text: "ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab ab" }).ok);
  check("symbol soup rejected", !garbageCheck("humanize_text", { text: "!!!$$$###@@@***((()))^^^%%%&&&===+++---___~~~||||{}[]<>???///\\\\ 12345 67890 !!!$$$###" }).ok);
  check("short topic rejected", !garbageCheck("social_pack", { topic: "AI" }).ok);
  check("real paragraph accepted", garbageCheck("proofread", {
    text: "Our onboarding email goes out three days after signup, but customers keep telling us they never saw it. We think the subject line is the problem and want a tighter version.",
  }).ok);
  check("real company accepted", garbageCheck("draft_cold_email", { company: "Acme Plumbing", angle: "" }).ok);
  check("url executors skip pre-check", garbageCheck("summarize_url", { url: "x" }).ok);
  check("unknown executor skips pre-check", garbageCheck("no_such_key", { text: "x" }).ok);

  // ── lintResult: format/style contracts ──
  const socialViolations = lintResult("social_pack", {
    topic: "t",
    linkedin: ["Great insights on #AI today"],
    x: ["y".repeat(300)],
  });
  check("hashtag flagged", socialViolations.some((v) => v.includes("hashtags")), socialViolations);
  check("over-280 X post flagged", socialViolations.some((v) => v.includes("280")), socialViolations);

  const emailViolations = lintResult("draft_cold_email", {
    company: "Acme",
    subject: "s".repeat(100),
    body: Array(200).fill("word").join(" "),
  });
  check("long subject flagged", emailViolations.some((v) => v.includes("subject")), emailViolations);
  check("long body flagged", emailViolations.some((v) => v.includes("150")), emailViolations);

  const refusalViolations = lintResult("proofread", {
    edited: "I cannot assist with editing this text because of its content and other reasons that prevent me here.",
  });
  check("partial refusal flagged", refusalViolations.some((v) => v.includes("refusal")), refusalViolations);
  check("clean result no violations", lintResult("proofread", { edited: "The report is finished and reads well." }).length === 0);

  // ── qualityGate fail-open (no GEMINI_API_KEY in this process) ──
  delete process.env.GEMINI_API_KEY;
  const gate = await qualityGate({
    serviceName: "Proofread",
    executorKey: "proofread",
    input: { text: "some perfectly reasonable input text for the executor to have worked on" },
    result: { edited: "Fixed text — with an em dash that autofix should strip." },
  });
  check("judge unavailable delivers (fail-open)", gate.deliver === true);
  check("unscored receipt says judged:false", (gate.result.quality as { judged: boolean }).judged === false);
  const edited = gate.result.edited as string;
  check("autofix stripped the em dash", !/[—–]/.test(edited), edited);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
