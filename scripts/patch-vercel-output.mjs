/**
 * Patches .vercel/output/functions/_not-found.func/.vc-config.json to declare
 * edge runtime. Next.js 15.5.2 does not propagate `export const runtime="edge"`
 * from not-found.tsx to the .vc-config.json, causing @cloudflare/next-on-pages
 * to reject the route. We fix it by copying the runtime config from an existing
 * known-good edge function in the same output directory.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const functionsDir = path.join(__dirname, "..", ".vercel", "output", "functions");
const notFoundDir = path.join(functionsDir, "_not-found.func");
const configPath = path.join(notFoundDir, ".vc-config.json");

if (!fs.existsSync(notFoundDir)) {
  console.log("patch-vercel-output: no _not-found.func found — skipping");
  process.exit(0);
}

const currentConfig = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, "utf8"))
  : null;

if (currentConfig?.runtime === "edge") {
  console.log("patch-vercel-output: _not-found.func already edge — no patch needed");
  process.exit(0);
}

console.log("patch-vercel-output: current config:", JSON.stringify(currentConfig));

// Find an existing edge function to use as a config template
let templateConfig = null;
if (fs.existsSync(functionsDir)) {
  for (const entry of fs.readdirSync(functionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.endsWith(".func") || entry.name === "_not-found.func") continue;
    const cfgPath = path.join(functionsDir, entry.name, ".vc-config.json");
    if (!fs.existsSync(cfgPath)) continue;
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    if (cfg.runtime === "edge") {
      templateConfig = cfg;
      console.log(`patch-vercel-output: using ${entry.name} as edge config template`);
      break;
    }
  }
}

// Find the JS entry file in _not-found.func
const notFoundFiles = fs.readdirSync(notFoundDir).filter((f) => f.endsWith(".js"));
const entrypoint =
  notFoundFiles.find((f) => f === "index.js") ?? notFoundFiles[0] ?? "index.js";

const patchedConfig = templateConfig
  ? { ...templateConfig, entrypoint }
  : { runtime: "edge", entrypoint };

fs.writeFileSync(configPath, JSON.stringify(patchedConfig, null, 2));
console.log(`patch-vercel-output: patched .vc-config.json → runtime=edge, entrypoint=${entrypoint}`);
