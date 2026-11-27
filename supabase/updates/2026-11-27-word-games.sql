-- Word games (Hot Seat, Explain It): each student's "Got it" / "Skip" taps,
-- as card numbers within their group. Students update their own row.
alter table public.participants add column if not exists got_cards integer[] not null default '{}';
alter table public.participants add column if not exists skipped_cards integer[] not null default '{}';
