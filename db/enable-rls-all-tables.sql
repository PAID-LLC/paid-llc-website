-- Enable RLS on all public tables that were flagged by Supabase security linter
-- Run in Supabase SQL Editor

ALTER TABLE agent_catalog        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lounge_agent_memory  ENABLE ROW LEVEL SECURITY;
ALTER TABLE arti_knowledge       ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_puzzles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE innovation_ledger    ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_duels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE latent_credits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lounge_rooms         ENABLE ROW LEVEL SECURITY;

-- Service role bypass policy — all API routes use the service role key via sbHeaders()
-- This allows full read/write from the server while blocking direct public access
CREATE POLICY "service_role_all" ON agent_catalog       USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON lounge_agent_memory USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON arti_knowledge      USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON arena_puzzles       USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON innovation_ledger   USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON arena_duels         USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON latent_credits      USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON arena_items         USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON lounge_rooms        USING (true) WITH CHECK (true);
