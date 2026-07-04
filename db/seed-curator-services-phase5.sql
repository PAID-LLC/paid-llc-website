-- ── Phase 5: service offering refresh ────────────────────────────────────────
-- Two things, both driven by 2026 marketplace demand research:
--   1. Rewrite the 8 existing service descriptions in human language. The old
--      copy showed machine syntax ('Supply {"url"}') to human buyers in
--      HirePanel; agents get the input schema from service_input_schema via
--      /api/ucp/bazaar, so the description no longer needs to carry it.
--   2. Add 4 new listings: the three highest-demand paid AI micro-tasks of
--      2026 (humanize, product descriptions, prompt upgrade) plus a 25-credit
--      premium anchor (Website Audit Brief) that feeds the human-led
--      Agentic Commerce Audit service.
--
-- Run AFTER db/dedupe-service-listings.sql (updates match on product_name, so
-- they are harmless on duplicates, but dedupe first keeps the catalog clean).
-- Idempotent: UPDATEs are repeat-safe; INSERTs have NOT EXISTS guards.

-- ── 1. Human-readable descriptions for existing services ─────────────────────

UPDATE agent_catalog SET description = 'Paste a link, get a tight 4 to 6 bullet summary of the page in seconds.'
WHERE agent_name = 'TheCurator' AND listing_type = 'service' AND product_name = 'Summarize a URL';

UPDATE agent_catalog SET description = 'A sharp outreach email with subject line and one clear call to action, under 120 words.'
WHERE agent_name = 'TheCurator' AND listing_type = 'service' AND product_name = 'Draft a Cold Email';

UPDATE agent_catalog SET description = 'An honest 0 to 100 score of any text against your criteria, with a one line rationale.'
WHERE agent_name = 'TheCurator' AND listing_type = 'service' AND product_name = 'Score a Response (0-100)';

UPDATE agent_catalog SET description = 'Grammar fixed, filler cut, plain language enforced. Your meaning and voice stay intact.'
WHERE agent_name = 'TheCurator' AND listing_type = 'service' AND product_name = 'Proofread + Tighten';

UPDATE agent_catalog SET description = 'Pull the fields you name out of messy text and get back clean, structured JSON.'
WHERE agent_name = 'TheCurator' AND listing_type = 'service' AND product_name = 'Extract Structured Data';

UPDATE agent_catalog SET description = 'Point it at a competitor page. Get positioning, strengths, weaknesses, and the gaps you can exploit.'
WHERE agent_name = 'TheCurator' AND listing_type = 'service' AND product_name = 'Competitor Teardown';

UPDATE agent_catalog SET description = 'Three LinkedIn posts and three X posts on your topic, ready to schedule.'
WHERE agent_name = 'TheCurator' AND listing_type = 'service' AND product_name = 'Social Post Pack';

UPDATE agent_catalog SET description = 'Raw notes or a transcript in, tight summary and a clean action item list out.'
WHERE agent_name = 'TheCurator' AND listing_type = 'service' AND product_name = 'Meeting Notes to Action Items';

-- ── 2. New listings ───────────────────────────────────────────────────────────

-- Humanize AI Text — 6 credits (the most requested AI edit of 2026)
INSERT INTO agent_catalog
  (agent_name, product_name, description, price_cents, checkout_url, active,
   platform_fee_percent, seller_earn_percent, listing_type, service_input_schema, sla_minutes, auto_verify, min_rep)
SELECT
  'TheCurator',
  'Humanize AI Text',
  'Strips the AI tells from generated copy: stiff phrasing, filler, robotic rhythm. Reads like a person wrote it.',
  6, 'https://paiddev.com/api/bazaar/service/request', true,
  20.00, 80.00, 'service',
  '{"executor":"humanize_text","fields":{"text":"string"}}'::jsonb,
  10, 'schema', 0
WHERE NOT EXISTS (
  SELECT 1 FROM agent_catalog WHERE agent_name = 'TheCurator' AND product_name = 'Humanize AI Text'
);

-- Product Description Pack — 8 credits
INSERT INTO agent_catalog
  (agent_name, product_name, description, price_cents, checkout_url, active,
   platform_fee_percent, seller_earn_percent, listing_type, service_input_schema, sla_minutes, auto_verify, min_rep)
SELECT
  'TheCurator',
  'Product Description Pack',
  'Three ready-to-publish product descriptions (short, medium, long) plus feature bullets and an SEO title.',
  8, 'https://paiddev.com/api/bazaar/service/request', true,
  20.00, 80.00, 'service',
  '{"executor":"product_descriptions","fields":{"product":"string","details":"string"}}'::jsonb,
  10, 'schema', 0
WHERE NOT EXISTS (
  SELECT 1 FROM agent_catalog WHERE agent_name = 'TheCurator' AND product_name = 'Product Description Pack'
);

-- Prompt Upgrade — 6 credits
INSERT INTO agent_catalog
  (agent_name, product_name, description, price_cents, checkout_url, active,
   platform_fee_percent, seller_earn_percent, listing_type, service_input_schema, sla_minutes, auto_verify, min_rep)
SELECT
  'TheCurator',
  'Prompt Upgrade',
  'Your prompt, rebuilt by an agent: clearer instructions, better structure, and two variants to test.',
  6, 'https://paiddev.com/api/bazaar/service/request', true,
  20.00, 80.00, 'service',
  '{"executor":"prompt_upgrade","fields":{"prompt":"string"}}'::jsonb,
  10, 'schema', 0
WHERE NOT EXISTS (
  SELECT 1 FROM agent_catalog WHERE agent_name = 'TheCurator' AND product_name = 'Prompt Upgrade'
);

-- Website Audit Brief — 25 credits (premium anchor; feeds the human-led audit)
INSERT INTO agent_catalog
  (agent_name, product_name, description, price_cents, checkout_url, active,
   platform_fee_percent, seller_earn_percent, listing_type, service_input_schema, sla_minutes, auto_verify, min_rep)
SELECT
  'TheCurator',
  'Website Audit Brief',
  'An agent reads your site and delivers a structured brief: positioning, clarity score, messaging issues, quick wins, and three copy rewrites.',
  25, 'https://paiddev.com/api/bazaar/service/request', true,
  20.00, 80.00, 'service',
  '{"executor":"website_audit_brief","fields":{"url":"string"}}'::jsonb,
  10, 'schema', 0
WHERE NOT EXISTS (
  SELECT 1 FROM agent_catalog WHERE agent_name = 'TheCurator' AND product_name = 'Website Audit Brief'
);

-- ── Verify ────────────────────────────────────────────────────────────────────
-- SELECT id, product_name, price_cents, description
-- FROM agent_catalog
-- WHERE listing_type = 'service' AND active = true
-- ORDER BY price_cents, id;
