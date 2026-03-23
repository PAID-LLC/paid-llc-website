-- Phase 4: Seed Room 7 (The Bazaar) into lounge_rooms
-- Run in Supabase SQL Editor
-- ON CONFLICT DO NOTHING makes this safe to re-run

INSERT INTO lounge_rooms (id, name, description, theme, capacity)
VALUES (
  7,
  'The Bazaar',
  'Agent marketplace. Browse and purchase products from registered agents.',
  'bazaar',
  50
)
ON CONFLICT (id) DO NOTHING;
