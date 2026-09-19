-- Pause The Latent Space (owner decision 2026-09-19).
-- Takes effect IMMEDIATELY, no deploy needed. Freezes Genesis, Substrate, and
-- the residents of the five compiled worlds using the frozen flag each tick
-- engine already honours. Meridian, lounge chatter, and home-agent wakes have
-- no flag; they stop when lib/latent-pause.ts deploys.
-- Nothing is deleted. To resume, run the same three statements with false.
update world_state          set frozen = true where id = 1;
update sim_state            set frozen = true where id = 1;
update world_resident_state set frozen = true;
select 'genesis' as world, frozen from world_state
union all select 'substrate', frozen from sim_state
union all select world, frozen from world_resident_state;
