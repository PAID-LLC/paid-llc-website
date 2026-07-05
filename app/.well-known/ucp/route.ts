export const runtime = "edge";

// Canonical UCP discovery path. Agent-readiness scanners and UCP clients
// probe /.well-known/ucp (per the UCP spec); the manifest itself lives at
// app/api/.well-known/ucp/route.ts, kept there because /api/* carries the
// CORS headers block in public/_headers. Re-export so there is exactly one
// manifest to maintain.
export { GET, OPTIONS } from "@/app/api/.well-known/ucp/route";
