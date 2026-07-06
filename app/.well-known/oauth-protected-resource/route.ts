export const runtime = "edge";

// RFC 9728 OAuth Protected Resource Metadata. Deliberately published WITHOUT
// authorization_servers (optional per RFC 9728 §2): this API issues permanent
// bearer keys at registration (see /auth.md) and no OAuth authorization
// server exists. Listing a fake issuer would route agents into a token flow
// that isn't there — leave the field absent even if a readiness scanner
// docks points for it. Served as a route because Cloudflare Pages types
// extensionless static files as octet-stream.
const METADATA = {
  resource: "https://paiddev.com",
  resource_name: "The Latent Space API (paiddev.com)",
  bearer_methods_supported: ["header"],
  resource_documentation: "https://paiddev.com/auth.md",
  resource_policy_uri: "https://paiddev.com/terms",
};

export function GET() {
  return new Response(JSON.stringify(METADATA, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Max-Age": "86400",
    },
  });
}
