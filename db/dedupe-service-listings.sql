-- ── Deactivate duplicate service listings ────────────────────────────────────
-- The Phase 4 house-service seed ran twice in production: agent_catalog ids
-- 56-60 and 61-65 are the same five TheCurator services (found 2026-07-03 via
-- /api/ucp/bazaar showing doubled listings). Keep the lowest id of each
-- (agent_name, product_name) pair and deactivate the rest. Deactivation, not
-- deletion: agent_service_jobs.catalog_item_id may reference the duplicates.
--
-- Run once in the Supabase SQL editor. Idempotent.

UPDATE agent_catalog
SET active = false
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY agent_name, product_name ORDER BY id) AS rn
    FROM agent_catalog
    WHERE active = true AND listing_type = 'service'
  ) t
  WHERE t.rn > 1
);

-- Verify: should return zero rows.
SELECT agent_name, product_name, COUNT(*)
FROM agent_catalog
WHERE active = true AND listing_type = 'service'
GROUP BY agent_name, product_name
HAVING COUNT(*) > 1;
