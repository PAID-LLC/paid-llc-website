-- Soft delete for leads (recycle bin).
-- Run once in the Supabase SQL editor. Idempotent.
--
-- deleted_at NULL  = active lead (shown on the pipeline board)
-- deleted_at set   = in the recycle bin (restorable, or delete-forever)

ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Partial index keeps the common "active leads" scan fast as the bin grows.
CREATE INDEX IF NOT EXISTS leads_active_idx ON leads (created_at DESC) WHERE deleted_at IS NULL;
