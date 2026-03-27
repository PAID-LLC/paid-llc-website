// create-coinbase-webhook.js
// One-time script to register the Coinbase CDP webhook subscription.
// Run: node create-coinbase-webhook.js
//
// Reads ~/Downloads/cdp_api_key.json for credentials.
// Prints the COINBASE_WEBHOOK_SECRET to add to Cloudflare Pages.

const fs     = require("fs");
const path   = require("path");
const os     = require("os");
const crypto = require("crypto");

const KEY_FILE        = path.join(os.homedir(), "Downloads", "cdp_api_key.json");
const SUBSCRIPTIONS   = "https://api.cdp.coinbase.com/platform/v2/data/webhooks/subscriptions";
const WEBHOOK_URL     = "https://paiddev.com/api/coinbase-webhook";

// ── Load key ──────────────────────────────────────────────────────────────────

let keyId, privateKeyPem;
try {
  const json = JSON.parse(fs.readFileSync(KEY_FILE, "utf8"));
  keyId        = json.name;
  privateKeyPem = json.privateKey.replace(/\\n/g, "\n");
} catch (e) {
  console.error("Could not read", KEY_FILE);
  console.error(e.message);
  process.exit(1);
}

// ── JWT generation (Node crypto, ES256 / ECDSA P-256) ─────────────────────────

function b64url(buf) {
  return Buffer.from(buf).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makeJWT(keyId, pem, uri) {
  const now   = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const header  = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = b64url(JSON.stringify({
    iss: "cdp", sub: keyId, nbf: now, exp: now + 120, uri, nonce,
  }));

  const input = `${header}.${payload}`;
  const sign  = crypto.createSign("SHA256");
  sign.update(input);
  // ieee-p1363 gives the raw r||s format required for JWT ES256
  const sig = sign.sign({ key: pem, dsaEncoding: "ieee-p1363" });
  return `${input}.${b64url(sig)}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Creating Coinbase CDP webhook subscription...\n");

  const jwt = makeJWT(keyId, privateKeyPem, `POST ${SUBSCRIPTIONS}`);

  const res = await fetch(SUBSCRIPTIONS, {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      description: "paiddev.com checkout fulfillment",
      eventTypes:  ["checkout.payment.success", "checkout.payment.failed", "checkout.payment.expired"],
      target: {
        url:    WEBHOOK_URL,
        method: "POST",
      },
      isEnabled: true,
    }),
  });

  const data = await res.json();
  console.log("HTTP status:", res.status);

  if (!res.ok) {
    console.error("Error response:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("Subscription created:", data.subscriptionId ?? data.id ?? "(see full response below)");

  const secret = data.metadata?.secret ?? data.secret;
  if (secret) {
    console.log("\n=== ADD THIS TO CLOUDFLARE PAGES ENV VARS ===");
    console.log("COINBASE_WEBHOOK_SECRET =", secret);
    console.log("=============================================\n");
  } else {
    console.log("\nFull response (look for secret field):");
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
