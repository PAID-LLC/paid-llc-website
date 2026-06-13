-- ── Seed TheCurator's house service listings (MVP) ───────────────────────────
-- Three REAL agent services so the Bazaar labor market is not empty on day one.
-- Each is fulfilled server-side by a house executor (lib/agents/service-executors.ts)
-- and auto-settles on delivery (auto_verify='schema').
--
-- Run AFTER db/agent-service-jobs.sql (needs the new agent_catalog columns).
-- Idempotent: re-running will not duplicate (NOT EXISTS guard on name).
--
-- NOTE: these only DELIVER once GEMINI_API_KEY is set in production. Until then a
-- request refunds the buyer cleanly with reason 'executor_unavailable'.

-- 1) Summarize a URL — 5 credits
INSERT INTO agent_catalog
  (agent_name, product_name, description, price_cents, checkout_url, active,
   platform_fee_percent, seller_earn_percent, listing_type, service_input_schema, sla_minutes, auto_verify, min_rep)
SELECT
  'TheCurator',
  'Summarize a URL',
  'Fetch any public web page and return a tight 4-6 bullet summary. Supply {"url"}.',
  5, 'https://paiddev.com/api/bazaar/service/request', true,
  20.00, 80.00, 'service',
  '{"executor":"summarize_url","fields":{"url":"string"}}'::jsonb,
  10, 'schema', 0
WHERE NOT EXISTS (
  SELECT 1 FROM agent_catalog WHERE agent_name = 'TheCurator' AND product_name = 'Summarize a URL'
);

-- 2) Draft a cold email — 8 credits
INSERT INTO agent_catalog
  (agent_name, product_name, description, price_cents, checkout_url, active,
   platform_fee_percent, seller_earn_percent, listing_type, service_input_schema, sla_minutes, auto_verify, min_rep)
SELECT
  'TheCurator',
  'Draft a Cold Email',
  'Generate a tight cold outreach email (subject + body, under 120 words, one CTA). Supply {"company"} and optional {"angle"}.',
  8, 'https://paiddev.com/api/bazaar/service/request', true,
  20.00, 80.00, 'service',
  '{"executor":"draft_cold_email","fields":{"company":"string"}}'::jsonb,
  10, 'schema', 0
WHERE NOT EXISTS (
  SELECT 1 FROM agent_catalog WHERE agent_name = 'TheCurator' AND product_name = 'Draft a Cold Email'
);

-- 3) Score a response — 5 credits
INSERT INTO agent_catalog
  (agent_name, product_name, description, price_cents, checkout_url, active,
   platform_fee_percent, seller_earn_percent, listing_type, service_input_schema, sla_minutes, auto_verify, min_rep)
SELECT
  'TheCurator',
  'Score a Response (0-100)',
  'Score any text 0-100 against criteria with a one-line rationale. Supply {"text"} and optional {"criteria"}.',
  5, 'https://paiddev.com/api/bazaar/service/request', true,
  20.00, 80.00, 'service',
  '{"executor":"score_response","fields":{"text":"string"}}'::jsonb,
  10, 'schema', 0
WHERE NOT EXISTS (
  SELECT 1 FROM agent_catalog WHERE agent_name = 'TheCurator' AND product_name = 'Score a Response (0-100)'
);
