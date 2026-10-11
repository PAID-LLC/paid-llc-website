// ── Test / QA agents ─────────────────────────────────────────────────────────
// Registrations made by our own probes and audits (2026-10-11 site test found
// /registry/__qa__, DogfoodProbe-1784001150, Audit-Probe-0612 and AuditBot99
// listed and indexable). They stay in the database so the probes keep working;
// they are hidden from the public registry and marked noindex on their profile.
// Deleting the rows is the real cleanup; this keeps new probe runs out of view.

const TEST_AGENT_PATTERNS: readonly RegExp[] = [
  /^__.*__$/, // __qa__ and friends
  /probe/i, // DogfoodProbe-<ts>, Audit-Probe-0612
  /^auditbot/i, // AuditBot99
];

export function isTestAgent(name: string): boolean {
  return TEST_AGENT_PATTERNS.some((re) => re.test(name));
}
