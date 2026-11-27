-- Take turns: the follow-up questions each student tapped as asked
-- ("round.turn.number" keys), for a leaderboard later. Students update their own row.
alter table public.participants add column if not exists asked_follow_ups text[] not null default '{}';
