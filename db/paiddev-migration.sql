-- ── PAID LLC receptionist: database migration ────────────────────────────────
-- Run once in the Supabase SQL editor for the paiddev.com project.

create table if not exists paiddev_leads (
  id               uuid         primary key default gen_random_uuid(),
  created_at       timestamptz  not null default now(),
  name             text,
  company          text,
  phone            text,
  service_interest text,
  timeline         text,
  notes            text,
  transcript       text,
  call_id          text,
  status           text         not null default 'new'
);

-- Admin-only: no anon access, service role only
alter table paiddev_leads enable row level security;

-- Enable real-time so the dashboard updates live during a demo
alter publication supabase_realtime add table paiddev_leads;
