export const runtime = "edge";

// RFC 8414 Authorization Server Metadata for the client_credentials-only AS
// at /api/oauth/token. Only capabilities that actually exist are listed:
// no authorization_endpoint (no interactive grant), no jwks_uri (HS256 —
// the verification key is the signing secret and cannot be published), and
// no /.well-known/openid-configuration anywhere (we issue no id_tokens;
// claiming OIDC would be fake metadata). response_types_supported is
// required by the RFC and honestly empty for a token-endpoint-only server.
const METADATA = {
  issuer: "https://paiddev.com",
  token_endpoint: "https://paiddev.com/api/oauth/token",
  grant_types_supported: ["client_credentials"],
  token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
  response_types_supported: [],
  service_documentation: "https://paiddev.com/auth.md",
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
