export const runtime = "edge";

// POST /api/oauth/token — RFC 6749 §4.4 client_credentials grant.
//
// This is a REAL authorization server, deliberately minimal: client_id is the
// agent_name and client_secret is the permanent api_key issued at registration
// (latent_registry), with a fallback to client_agents' agent_secret. It mints
// the same short-lived HS256 session JWT the rest of the platform already
// accepts (UCP, MCP, and verifyAgentWrite surfaces). Advertised via RFC 8414
// metadata at /.well-known/oauth-authorization-server.
//
// Unknown agent and wrong secret both return a uniform invalid_client — this
// endpoint must not confirm which keys are valid for which names.

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { signJwt, hashAgentSecret } from "@/lib/jwt";
import { timingSafeEqual } from "@/lib/admin-auth";
import { underDailyLimit } from "@/lib/usage-guard";

const TOKEN_TTL = 3600; // 1 hour — OAuth-norm short-lived; re-auth is one call

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function oauthError(
  error: "invalid_request" | "invalid_client" | "unsupported_grant_type",
  description: string,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ error, error_description: description }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      ...CORS,
      ...extraHeaders,
    },
  });
}

interface TokenParams {
  grant_type?: string;
  client_id?: string;
  client_secret?: string;
  usedBasic: boolean;
}

async function parseParams(req: Request): Promise<TokenParams | null> {
  const params: TokenParams = { usedBasic: false };

  const basic = req.headers.get("Authorization");
  if (basic?.startsWith("Basic ")) {
    params.usedBasic = true;
    try {
      const decoded = atob(basic.slice(6).trim());
      const sep = decoded.indexOf(":");
      if (sep === -1) return null;
      // RFC 6749 §2.3.1: credentials inside Basic are form-urlencoded first.
      const dec = (s: string) => {
        try { return decodeURIComponent(s.replace(/\+/g, "%20")); } catch { return s; }
      };
      params.client_id = dec(decoded.slice(0, sep));
      params.client_secret = dec(decoded.slice(sep + 1));
    } catch {
      return null;
    }
  }

  const contentType = req.headers.get("Content-Type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as Record<string, unknown>;
      for (const k of ["grant_type", "client_id", "client_secret"] as const) {
        if (typeof body[k] === "string" && !params[k]) params[k] = body[k] as string;
      }
    } else {
      const form = await req.formData();
      for (const k of ["grant_type", "client_id", "client_secret"] as const) {
        const v = form.get(k);
        if (typeof v === "string" && !params[k]) params[k] = v;
      }
    }
  } catch {
    // Empty or unparseable body is fine when Basic auth carried the
    // credentials — grant_type absence is caught below either way.
  }

  return params;
}

async function credentialsValid(agentName: string, secret: string): Promise<boolean> {
  // Primary population: self-serve registry agents, secret = permanent api_key.
  const regRes = await fetch(
    sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=api_key&limit=1`),
    { headers: sbHeaders() },
  );
  if (regRes.ok) {
    const rows = (await regRes.json()) as { api_key: string | null }[];
    if (rows[0]?.api_key && (await timingSafeEqual(secret, rows[0].api_key))) return true;
  }

  // Fallback population: curated client agents, secret = agent_secret (hashed).
  const cliRes = await fetch(
    sbUrl(`client_agents?name=eq.${encodeURIComponent(agentName)}&active=eq.true&select=agent_secret_hash&limit=1`),
    { headers: sbHeaders() },
  );
  if (cliRes.ok) {
    const rows = (await cliRes.json()) as { agent_secret_hash: string | null }[];
    if (rows[0]?.agent_secret_hash) {
      const hash = await hashAgentSecret(agentName, secret);
      return await timingSafeEqual(hash, rows[0].agent_secret_hash);
    }
  }

  return false;
}

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady() || !process.env.JWT_SECRET) {
    return new Response(JSON.stringify({ error: "temporarily_unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
    });
  }

  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  if (!(await underDailyLimit(`oauth_token:${ip}`, 200))) {
    return oauthError("invalid_request", "Rate limit exceeded. Try again tomorrow.", 429);
  }

  const params = await parseParams(req);
  if (!params) {
    return oauthError("invalid_request", "Malformed Basic authorization header.", 400);
  }

  const basicChallenge: Record<string, string> = params.usedBasic
    ? { "WWW-Authenticate": 'Basic realm="paiddev.com"' }
    : {};

  if (!params.grant_type) {
    return oauthError("invalid_request", "grant_type is required.", 400);
  }
  if (params.grant_type !== "client_credentials") {
    return oauthError(
      "unsupported_grant_type",
      "Only client_credentials is supported. client_id = agent_name, client_secret = your api_key. See https://paiddev.com/auth.md",
      400,
    );
  }
  if (!params.client_id || !params.client_secret) {
    return oauthError(
      "invalid_request",
      "client_id (agent_name) and client_secret (api_key) are required, via Basic auth or body.",
      400,
    );
  }

  if (!(await credentialsValid(params.client_id, params.client_secret))) {
    return oauthError("invalid_client", "Client authentication failed.", 401, basicChallenge);
  }

  const access_token = await signJwt({ sub: params.client_id, tier: "verified-client" }, TOKEN_TTL);
  return new Response(
    JSON.stringify({ access_token, token_type: "Bearer", expires_in: TOKEN_TTL }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Pragma: "no-cache",
        ...CORS,
      },
    },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "86400" } });
}
