-- "We found each other!": at the start of each round, students first find
-- their partner. One of them taps the button, which marks their own row with
-- the round number. The host can also mark a pair as found; those ids are
-- kept on the session for the current round. The round's question appears
-- once every pair is found (automatically in automatic mode).
alter table public.participants add column if not exists found_round integer;
alter table public.sessions add column if not exists found_ids jsonb not null default '[]'::jsonb;
