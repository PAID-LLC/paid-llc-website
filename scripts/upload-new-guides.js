// Upload new guide PDFs to Supabase Storage (guides bucket)
// Run from website root: node scripts/upload-new-guides.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, "../.env.local");
const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local");
  process.exit(1);
}

// ── Files to upload ────────────────────────────────────────────────────────────
// [source filename in formatted/ dir, destination filename in Supabase]
const FORMATTED_DIR = path.join(
  __dirname,
  "../../Executive Assistant Claude Cowork/projects/digital-products/formatted"
);

const FILES = [
  ["2026-05-09-claude-for-business-practical-playbook.pdf",  "claude-for-business-practical-playbook.pdf"],
  ["2026-05-09-ai-agents-for-small-business.pdf",            "ai-agents-for-small-business.pdf"],
  ["2026-05-09-build-without-code-cursor-ai-coding-guide.pdf", "cursor-ai-coding-guide.pdf"],
  ["2026-05-09-copilot-cowork-microsoft-365-team-guide.pdf", "copilot-cowork-microsoft-365-team-guide.pdf"],
  ["2026-05-10-free-ai-stack-small-business-setup.pdf",      "free-ai-stack-small-business-setup.pdf"],
  ["2026-05-10-jumpstart-business-ai-under-100.pdf",         "jumpstart-business-ai-under-100.pdf"],
  ["2026-05-10-enterprise-ai-deployment-guide.pdf",          "enterprise-ai-deployment-guide.pdf"],
];

// ── Upload ─────────────────────────────────────────────────────────────────────
async function upload(srcFilename, destFilename) {
  const srcPath = path.join(FORMATTED_DIR, srcFilename);
  if (!fs.existsSync(srcPath)) {
    console.error(`  MISSING: ${srcPath}`);
    return false;
  }

  const body = fs.readFileSync(srcPath);
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/guides/${encodeURIComponent(destFilename)}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/pdf",
        "x-upsert": "true",
      },
      body,
    }
  );

  if (res.ok) {
    console.log(`  OK  ${destFilename}`);
    return true;
  } else {
    const err = await res.text();
    console.error(`  FAIL ${destFilename}: ${res.status} ${err}`);
    return false;
  }
}

console.log(`\nUploading ${FILES.length} guides to Supabase Storage (guides bucket)...\n`);
let passed = 0;
for (const [src, dest] of FILES) {
  const ok = await upload(src, dest);
  if (ok) passed++;
}
console.log(`\nDone: ${passed}/${FILES.length} uploaded.\n`);
if (passed < FILES.length) {
  console.log("Fix the errors above and re-run. Already-uploaded files will be skipped (upsert is safe).");
}
