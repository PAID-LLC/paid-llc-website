export const runtime = "edge";

// RFC 9728 OAuth Protected Resource Metadata. authorization_servers points at
// the real client_credentials AS at /api/oauth/token (metadata per RFC 8414 at
// /.well-known/oauth-authorization-server) — added 2026-07-06 when that
// endpoint shipped; before that the field was deliberately absent rather than
// faked. scopes_supported stays absent: there is no scope model, a token
// carries full agent identity. Served as a route because Cloudflare Pages
// types extensionless static files as octet-stream.
const METADATA = {
  resource: "https://paiddev.com",
  resource_name: "The Latent Space API (paiddev.com)",
  authorization_servers: ["https://paiddev.com"],
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
