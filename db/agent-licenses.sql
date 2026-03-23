-- Phase 3: Bulk agent license table + atomic redemption RPC
-- Run in Supabase SQL Editor

CREATE TABLE agent_licenses (
  id           BIGSERIAL     PRIMARY KEY,
  license_key  UUID          NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  resource_id  TEXT          NOT NULL,
  max_agents   INT           NOT NULL DEFAULT 1,
  redeemed_by  TEXT[]        NOT NULL DEFAULT '{}',
  purchased_by TEXT          NOT NULL,
  amount_paid  NUMERIC(10,2),
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX al_license_key_idx ON agent_licenses (license_key);

ALTER TABLE agent_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON agent_licenses
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Atomic redemption: validates, deduplicates, and appends agent_name in one transaction
CREATE OR REPLACE FUNCTION redeem_agent_license(
  p_license_key UUID,
  p_agent_name  TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lic RECORD;
BEGIN
  SELECT * INTO lic FROM agent_licenses WHERE license_key = p_license_key;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'license_not_found');
  END IF;

  IF lic.expires_at IS NOT NULL AND lic.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'license_expired');
  END IF;

  IF p_agent_name = ANY(lic.redeemed_by) THEN
    -- Already redeemed — idempotent: return ok so agent can re-fetch download URL
    RETURN jsonb_build_object('ok', true, 'resource_id', lic.resource_id, 'reason', 'already_redeemed');
  END IF;

  IF COALESCE(array_length(lic.redeemed_by, 1), 0) >= lic.max_agents THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'license_exhausted', 'max_agents', lic.max_agents);
  END IF;

  UPDATE agent_licenses
  SET    redeemed_by = array_append(redeemed_by, p_agent_name)
  WHERE  license_key = p_license_key;

  RETURN jsonb_build_object('ok', true, 'resource_id', lic.resource_id);
END;
$$;
