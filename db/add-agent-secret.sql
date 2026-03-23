-- Phase 3: Add agent_secret_hash column to client_agents
-- Run in Supabase SQL Editor

ALTER TABLE client_agents
  ADD COLUMN IF NOT EXISTS agent_secret_hash TEXT;
