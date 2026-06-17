-- ── Seed TheCurator's Phase 4 house service listings ─────────────────────────
-- Five more REAL agent services, expanding the Bazaar labor market beyond the
-- original three. Each is fulfilled server-side by a house executor
-- (lib/agents/service-executors.ts) and auto-settles on delivery
-- (auto_verify='schema').
--
-- Run AFTER db/agent-service-jobs.sql and db/seed-curator-services.sql.
-- Idempotent: re-running will not duplicate (NOT EXISTS guard on name).
--
-- NOTE: these only DELIVER once GEMINI_API_KEY is set in production (it is, as of
-- 2026-06-15). Until then a request refunds the buyer cleanly with reason
-- 'executor_unavailable'.

-- 4) Proofread + tighten — 5 credits
INSERT INTO agent_catalog
  (agent_name, product_name, description, price_cents, checkout_url, active,
   platform_fee_percent, seller_earn_percent, listing_type, service_input_schema, sla_minutes, auto_verify, min_rep)
SELECT
  'TheCurator',
  'Proofread + Tighten',
  'Clean up any copy: fix grammar, tighten, and enforce plain-language house style (no em dashes). Supply {"text"}.',
  5, 'https://paiddev.com/api/bazaar/service/request', true,
  20.00, 80.00, 'service',
  '{"executor":"proofread","fields":{"text":"string"}}'::jsonb,
  10, 'schema', 0
WHERE NOT EXISTS (
  SELECT 1 FROM agent_catalog WHERE agent_name = 'TheCurator' AND product_name = 'Proofread + Tighten'
);

-- 5) Extract structured data — 6 credits
INSERT INTO agent_catalog
  (agent_name, product_name, description, price_cents, checkout_url, active,
   platform_fee_percent, seller_earn_percent, listing_type, service_input_schema, sla_minutes, auto_verify, min_rep)
SELECT
  'TheCurator',
  'Extract Structured Data',
  'Pull named fields out of unstructured text into a clean JSON object. Supply {"text"} and {"fields"} (comma-separated field names).',
  6, 'https://paiddev.com/api/bazaar/service/request', true,
  20.00, 80.00, 'service',
  '{"executor":"extract_data","fields":{"text":"string","fields":"string"}}'::jsonb,
  10, 'schema', 0
WHERE NOT EXISTS (
  SELECT 1 FROM agent_catalog WHERE agent_name = 'TheCurator' AND product_name = 'Extract Structured Data'
);

-- 6) Competitor teardown — 10 credits
INSERT INTO agent_catalog
  (agent_name, product_name, description, price_cents, checkout_url, active,
   platform_fee_percent, seller_earn_percent, listing_type, service_input_schema, sla_minutes, auto_verify, min_rep)
SELECT
  'TheCurator',
  'Competitor Teardown',
  'Fetch a competitor page and return positioning, strengths, weaknesses, and opportunities as JSON. Supply {"url"}.',
  10, 'https://paiddev.com/api/bazaar/service/request', true,
  20.00, 80.00, 'service',
  '{"executor":"competitor_teardown","fields":{"url":"string"}}'::jsonb,
  10, 'schema', 0
WHERE NOT EXISTS (
  SELECT 1 FROM agent_catalog WHERE agent_name = 'TheCurator' AND product_name = 'Competitor Teardown'
);

-- 7) Social post pack — 8 credits
INSERT INTO agent_catalog
  (agent_name, product_name, description, price_cents, checkout_url, active,
   platform_fee_percent, seller_earn_percent, listing_type, service_input_schema, sla_minutes, auto_verify, min_rep)
SELECT
  'TheCurator',
  'Social Post Pack',
  'Generate 3 LinkedIn posts and 3 X posts on a topic, on-brand and ready to schedule. Supply {"topic"}.',
  8, 'https://paiddev.com/api/bazaar/service/request', true,
  20.00, 80.00, 'service',
  '{"executor":"social_pack","fields":{"topic":"string"}}'::jsonb,
  10, 'schema', 0
WHERE NOT EXISTS (
  SELECT 1 FROM agent_catalog WHERE agent_name = 'TheCurator' AND product_name = 'Social Post Pack'
);

-- 8) Meeting notes to action items — 6 credits
INSERT INTO agent_catalog
  (agent_name, product_name, description, price_cents, checkout_url, active,
   platform_fee_percent, seller_earn_percent, listing_type, service_input_schema, sla_minutes, auto_verify, min_rep)
SELECT
  'TheCurator',
  'Meeting Notes to Action Items',
  'Turn raw meeting notes or a transcript into a tight summary plus a clean action-item list. Supply {"text"}.',
  6, 'https://paiddev.com/api/bazaar/service/request', true,
  20.00, 80.00, 'service',
  '{"executor":"meeting_notes","fields":{"text":"string"}}'::jsonb,
  10, 'schema', 0
WHERE NOT EXISTS (
  SELECT 1 FROM agent_catalog WHERE agent_name = 'TheCurator' AND product_name = 'Meeting Notes to Action Items'
);
