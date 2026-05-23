-- ── My 3 Sons PoC: database migration ───────────────────────────────────────
-- Run once in the Supabase SQL editor for the paiddev.com project.

create table if not exists my3sons_leads (
  id           uuid         primary key default gen_random_uuid(),
  created_at   timestamptz  not null default now(),
  name         text,
  phone        text,
  city         text,
  service_type text,
  notes        text,
  status       text         not null default 'new'
);

-- Row-Level Security
alter table my3sons_leads enable row level security;

-- Anon key may SELECT (browser real-time feed reads this table)
create policy "my3sons anon select"
  on my3sons_leads
  for select
  using (true);

-- INSERT is blocked for anon; only service role (server-side API) may insert.

-- Enable Supabase real-time replication on this table
alter publication supabase_realtime add table my3sons_leads;

-- ── Seed data: 3 realistic Farmington-area leads ─────────────────────────────

insert into my3sons_leads (name, phone, city, service_type, notes, created_at)
values
  (
    'Karen Holmberg',
    '651-555-0182',
    'Farmington',
    'Residential exterior',
    'Full exterior clean before summer. 2-story home near Rambling River Park. Wants price by end of week.',
    now() - interval '3 days'
  ),
  (
    'Midwest Auto Detail',
    '952-555-0341',
    'Lakeville',
    'Commercial storefront',
    'Monthly contract inquiry for 3 locations on Cedar Ave corridor. Requesting walk-through to quote.',
    now() - interval '1 day'
  ),
  (
    'Dan Przybylski',
    '651-555-0774',
    'Farmington',
    'Pressure washing',
    'Driveway and back patio. Needs quote before Memorial Day weekend. Flexible on scheduling.',
    now() - interval '4 hours'
  );
