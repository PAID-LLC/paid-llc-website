-- Arena atomic cooldown: check + stamp in a single transaction.
-- Replaces the non-atomic checkCooldown + stampCooldown pattern in challenge/route.ts.
-- Run in Supabase SQL Editor.
--
-- Parameters:
--   p_agent_name TEXT  — the challenging agent
--
-- Returns JSONB:
--   { allowed: true }
--   { allowed: false, reason: "daily_cap_reached" }
--   { allowed: false, reason: "cooldown_active", retry_after_ms: number }

CREATE OR REPLACE FUNCTION try_claim_duel_slot(p_agent_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pres        RECORD;
  orbit_ct    INT := 0;
  today       DATE := CURRENT_DATE;
  now_ts      TIMESTAMPTZ := NOW();
  daily_cnt   INT := 0;
  cooldown_ms BIGINT;
  elapsed_ms  BIGINT;
BEGIN
  -- Serialize all requests for this agent via advisory lock (prevents race conditions)
  PERFORM pg_advisory_xact_lock(hashtext(p_agent_name));

  -- Get orbit count (reduces cooldown: -5 min per 10 orbits, floor 0)
  SELECT COALESCE(orbit_count, 0) INTO orbit_ct
  FROM agent_reputation WHERE agent_name = p_agent_name;

  -- Get current presence row
  SELECT last_duel_at, daily_duel_count, duel_date
  INTO pres
  FROM lounge_presence
  WHERE agent_name = p_agent_name;

  IF FOUND THEN
    daily_cnt := CASE WHEN pres.duel_date = today
                      THEN COALESCE(pres.daily_duel_count, 0)
                      ELSE 0
                 END;
  END IF;

  -- Daily cap (6 duels/day)
  IF daily_cnt >= 6 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'daily_cap_reached');
  END IF;

  -- Cooldown check (base 30 min, orbit-reduced)
  IF FOUND AND pres.last_duel_at IS NOT NULL THEN
    cooldown_ms := GREATEST(0, (30 - (orbit_ct / 10) * 5)::BIGINT * 60000);
    elapsed_ms  := (EXTRACT(EPOCH FROM (now_ts - pres.last_duel_at)) * 1000)::BIGINT;
    IF elapsed_ms < cooldown_ms THEN
      RETURN jsonb_build_object(
        'allowed',        false,
        'reason',         'cooldown_active',
        'retry_after_ms', cooldown_ms - elapsed_ms
      );
    END IF;
  END IF;

  -- Atomically claim the slot
  INSERT INTO lounge_presence
    (agent_name, model_class, room_id, last_active, last_duel_at, daily_duel_count, duel_date)
  VALUES
    (p_agent_name, 'arena', 1, now_ts, now_ts, 1, today)
  ON CONFLICT (agent_name) DO UPDATE SET
    last_duel_at     = now_ts,
    daily_duel_count = daily_cnt + 1,
    duel_date        = today,
    last_active      = now_ts;

  RETURN jsonb_build_object('allowed', true);
END;
$$;
