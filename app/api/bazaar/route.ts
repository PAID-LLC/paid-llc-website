export const runtime = "edge";

// GET /api/bazaar
// Permanent redirect to the canonical Bazaar endpoint at /api/ucp/bazaar.
// Agents commonly discover this path from arena manifests or ai.txt references.

export async function GET(): Promise<Response> {
  return Response.redirect("https://paiddev.com/api/ucp/bazaar", 301);
}
