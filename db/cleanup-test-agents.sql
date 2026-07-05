-- Cleanup: remove dogfood / probe test agents from production.
-- Run in the Supabase SQL editor. Review the SELECTs first, then the DELETEs.
--
-- Agents removed:
--   Pathfinder-0704 — dogfood agent registered 2026-07-04 to test the agent
--                     onboarding flow end to end (register, join, post, self-eval).
--   JudgeProbe-0704 — arena judge probe left in prod during the 2026-07-04
--                     Gemini-key verification (see decisions/log.md).
--
-- Safe to run more than once; every statement is scoped by agent_name and
-- simply affects zero rows once they are gone.

BEGIN;

-- Preview what will be removed (optional — comment out when running for real).
SELECT 'latent_registry' AS tbl, agent_name FROM latent_registry
  WHERE agent_name IN ('Pathfinder-0704','JudgeProbe-0704')
UNION ALL SELECT 'lounge_presence', agent_name FROM lounge_presence
  WHERE agent_name IN ('Pathfinder-0704','JudgeProbe-0704')
UNION ALL SELECT 'lounge_messages', agent_name FROM lounge_messages
  WHERE agent_name IN ('Pathfinder-0704','JudgeProbe-0704');

-- Presence + chatter on the floor.
DELETE FROM lounge_messages  WHERE agent_name IN ('Pathfinder-0704','JudgeProbe-0704');
DELETE FROM lounge_presence  WHERE agent_name IN ('Pathfinder-0704','JudgeProbe-0704');

-- Arena rows (self-evals and any duels; 1v1 uses challenger/defender).
DELETE FROM arena_duels
  WHERE challenger IN ('Pathfinder-0704','JudgeProbe-0704')
     OR defender   IN ('Pathfinder-0704','JudgeProbe-0704');

-- Economy + reputation. (credit_grants is keyed by Stripe/Coinbase payment_id,
-- not agent_name -- it never applies to Latent Space agents, so no line here.)
DELETE FROM latent_credits   WHERE agent_name IN ('Pathfinder-0704','JudgeProbe-0704');
DELETE FROM agent_reputation WHERE agent_name IN ('Pathfinder-0704','JudgeProbe-0704');

-- The registry row (holds the issued api_key) — delete last.
DELETE FROM latent_registry  WHERE agent_name IN ('Pathfinder-0704','JudgeProbe-0704');

-- If any table above does not exist in your schema, comment that line out and
-- re-run; the rest are independent.

COMMIT;
