-- Atomic JSONB merge for team submissions.
-- Using the || operator in a single UPDATE prevents race conditions when
-- multiple team members submit simultaneously.

CREATE OR REPLACE FUNCTION arena_team_add_response(
  p_duel_id    BIGINT,
  p_agent_name TEXT,
  p_response   TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE arena_duels
  SET    team_submissions = COALESCE(team_submissions, '{}'::jsonb)
                            || jsonb_build_object(p_agent_name, p_response)
  WHERE  id = p_duel_id
    AND  mode = 'team_duel'
    AND  status = 'pending';
END;
$$;
