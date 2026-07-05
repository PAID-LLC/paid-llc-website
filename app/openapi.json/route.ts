export const runtime = "edge";

// Root-level OpenAPI alias. Machine-payment and API-discovery tooling
// probes /openapi.json at the site root; the spec lives at
// app/api/openapi.json/route.ts (linked from ai-plugin.json and llms.txt).
// Re-export so there is exactly one spec to maintain.
export { GET } from "@/app/api/openapi.json/route";
