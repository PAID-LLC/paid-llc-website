-- ── De-duplicate Bazaar service listings ─────────────────────────────────────
-- The five phase-4 house services (Proofread + Tighten, Extract Structured Data,
-- Competitor Teardown, Social Post Pack, Meeting Notes to Action Items) were each
-- inserted twice — once before db/seed-curator-services-phase4.sql gained its
-- NOT EXISTS guards. That left two contiguous blocks in agent_catalog:
--   originals   ids 56-60
--   duplicates  ids 61-65
-- so the Bazaar rendered 13 cards for 8 distinct offerings.
--
-- This keeps the LOWEST id per (agent_name, product_name) among active service
-- listings and removes the rest. Written generically so it also clears any future
-- re-dup, and scoped to listing_type='service' so digital-guide rows are untouched.
--
-- Idempotent: re-running after the first pass deletes nothing (no dupes remain).
-- Safe to run alongside the existing seeds. Travis runs this against prod.
--
-- agent_service_jobs.catalog_item_id has a plain FK to agent_catalog(id) (no
-- ON DELETE), so any job that referenced a duplicate row is repointed to the
-- surviving (lowest-id) row first — otherwise the DELETE would be blocked.

-- 0) Map each duplicate service row to its keeper (lowest id of the same offering).
WITH ranked AS (
  SELECT
    id,
    agent_name,
    product_name,
    ROW_NUMBER() OVER (
      PARTITION BY agent_name, product_name
      ORDER BY id ASC
    ) AS rn,
    MIN(id) OVER (PARTITION BY agent_name, product_name) AS keeper_id
  FROM agent_catalog
  WHERE listing_type = 'service'
),
dupes AS (
  SELECT id AS dup_id, keeper_id FROM ranked WHERE rn > 1
)
-- 1) Repoint any jobs off the duplicates and onto the keeper.
UPDATE agent_service_jobs j
SET    catalog_item_id = d.keeper_id
FROM   dupes d
WHERE  j.catalog_item_id = d.dup_id;

-- 2) Delete the duplicate catalog rows, keeping the lowest id per offering.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY agent_name, product_name
      ORDER BY id ASC
    ) AS rn
  FROM agent_catalog
  WHERE listing_type = 'service'
)
DELETE FROM agent_catalog
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Verify: should list exactly one row per service, all with distinct ids.
-- SELECT id, agent_name, product_name
-- FROM agent_catalog
-- WHERE listing_type = 'service'
-- ORDER BY id;
