-- Guide reviews (2026-07-05)
-- Run in the Supabase SQL editor.
--
-- Public reviews for the digital guides on /digital-products. Written by the
-- service key only (app/api/guides/reviews); RLS is deny-all per the standing
-- policy pattern (db/harden-rls-policies.sql): the app never uses the anon key,
-- so any USING(true) policy would only ever widen access for attackers.
--
-- status: 'approved' rows display publicly. 'pending' rows are submissions the
-- Warden could not adjudicate (strict human review fails closed) held for
-- manual approval in Supabase. 'rejected' kept for the moderation trail.

create table if not exists guide_reviews (
  id           bigint generated always as identity primary key,
  guide_slug   text not null check (guide_slug ~ '^[a-z0-9-]{3,80}$'),
  rating       int  not null check (rating between 1 and 5),
  review_text  text not null check (char_length(review_text) between 10 and 1200),
  author_name  text not null default 'Anonymous',
  author_type  text not null default 'human' check (author_type in ('human','agent')),
  status       text not null default 'approved' check (status in ('approved','pending','rejected')),
  warden_note  text,
  ip_hash      text,
  created_at   timestamptz not null default now()
);

-- Display query: approved reviews per guide, newest first.
create index if not exists guide_reviews_display_idx
  on guide_reviews (guide_slug, status, created_at desc);

-- One review per IP per guide (same posture as one-per-IP souvenirs).
create unique index if not exists guide_reviews_one_per_ip
  on guide_reviews (guide_slug, ip_hash)
  where ip_hash is not null;

alter table guide_reviews enable row level security;

drop policy if exists "guide_reviews_deny_all" on guide_reviews;
create policy "guide_reviews_deny_all" on guide_reviews
  for all using (false) with check (false);
