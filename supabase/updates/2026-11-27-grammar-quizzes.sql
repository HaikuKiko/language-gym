-- Grammar quizzes (27 Nov 2026): a teacher's quiz sets made from the week's
-- grammar, their questions, each student's answers, and a shared scores table
-- for leaderboards across games.

-- ---------------------------------------------------------------------------
-- Quiz sets: one per week (e.g. "Week of 30 Nov"), made by the make-quiz
-- edge function from the grammar the teacher typed or photographed.
-- ---------------------------------------------------------------------------
create table if not exists public.quiz_sets (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- The levels mixed in this set, e.g. {A1,A2}.
  levels text[] not null,
  -- The grammar for each level, as typed: {"A1": "...", "A2": "..."}.
  grammar jsonb not null default '{}',
  quiz_count integer not null check (quiz_count between 1 and 10),
  -- "New question" uses so far (capped in the edge function).
  remakes integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists quiz_sets_host_idx on public.quiz_sets (host_id, created_at desc);
alter table public.quiz_sets enable row level security;
grant select, update, delete on public.quiz_sets to authenticated;

drop policy if exists "Teachers manage their own quiz sets" on public.quiz_sets;
create policy "Teachers manage their own quiz sets"
  on public.quiz_sets for all to authenticated
  using (host_id = auth.uid() and public.is_teacher())
  with check (host_id = auth.uid() and public.is_teacher());

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.quiz_sets (id) on delete cascade,
  -- Which quiz of the set (1, 2, …) and the order within it.
  quiz integer not null,
  position integer not null,
  level text not null,
  -- choose: fill the gap; right-wrong: is the sentence right?; find-mistake: tap the wrong part.
  kind text not null check (kind in ('choose', 'right-wrong', 'find-mistake')),
  prompt text not null check (char_length(prompt) between 1 and 300),
  options text[] not null check (cardinality(options) between 2 and 4),
  answer integer not null check (answer >= 0 and answer < 4),
  why text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists quiz_questions_set_idx on public.quiz_questions (set_id, quiz, position);
alter table public.quiz_questions enable row level security;
grant select, insert, update, delete on public.quiz_questions to authenticated;

drop policy if exists "Teachers manage their own quiz questions" on public.quiz_questions;
create policy "Teachers manage their own quiz questions"
  on public.quiz_questions for all to authenticated
  using (exists (select 1 from public.quiz_sets s where s.id = set_id and s.host_id = auth.uid()))
  with check (exists (select 1 from public.quiz_sets s where s.id = set_id and s.host_id = auth.uid()));

-- Students read the questions of a quiz they are playing (the session has the flag quiz:<set id>).
create or replace function public.can_play_quiz(p_set_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from sessions s
    join participants p on p.session_id = s.id
    where p.user_id = auth.uid()
      and s.status <> 'finished'
      and s.categories @> array['quiz:' || p_set_id::text]
  );
$$;
revoke all on function public.can_play_quiz(uuid) from public;
grant execute on function public.can_play_quiz(uuid) to authenticated;

drop policy if exists "Students read the quiz they are playing" on public.quiz_questions;
create policy "Students read the quiz they are playing"
  on public.quiz_questions for select to authenticated
  using (public.can_play_quiz(set_id));

-- ---------------------------------------------------------------------------
-- Answers: on each student's own participant row, {"<question>": {"c": choice, "ms": time}}.
-- Saved through answer_quiz, so an answer only counts once, and only while the question is open.
-- ---------------------------------------------------------------------------
alter table public.participants add column if not exists quiz_answers jsonb not null default '{}';

create or replace function public.answer_quiz(p_participant_id uuid, p_question integer, p_choice integer, p_ms integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  added boolean;
begin
  update participants p
  set quiz_answers = p.quiz_answers || jsonb_build_object(p_question::text, jsonb_build_object('c', p_choice, 'ms', greatest(0, p_ms)))
  from sessions s
  where p.id = p_participant_id
    and p.user_id = auth.uid()
    and s.id = p.session_id
    and s.status = 'playing'
    and s.round = p_question
    and s.stage = 'discussion'
    -- A couple of seconds' grace for slow wifi.
    and (s.ends_at is null or now() <= s.ends_at + interval '2 seconds')
    and not (p.quiz_answers ? p_question::text);
  get diagnostics added = row_count;
  return added;
end;
$$;
revoke all on function public.answer_quiz(uuid, integer, integer, integer) from public;
grant execute on function public.answer_quiz(uuid, integer, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Scores for leaderboards across games (any activity: quizzes now, word games later).
-- One row per student per game, written by the host at the end. Kept 60 days.
-- ---------------------------------------------------------------------------
create table if not exists public.player_scores (
  id bigint generated always as identity primary key,
  host_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- e.g. 'quiz'
  activity text not null,
  -- Groups games into one leaderboard, e.g. the quiz set's id ("this week").
  board text not null default '',
  -- No foreign key: sessions are deleted after 30 days, scores are kept longer.
  session_id uuid,
  name text not null check (char_length(name) between 1 and 40),
  points integer not null default 0,
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (session_id, name)
);
create index if not exists player_scores_host_idx on public.player_scores (host_id, activity, created_at desc);
alter table public.player_scores enable row level security;
grant select, insert, update, delete on public.player_scores to authenticated;

drop policy if exists "Hosts manage their own scores" on public.player_scores;
create policy "Hosts manage their own scores"
  on public.player_scores for all to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

-- Every night: scores older than 60 days are deleted (as saved names).
create or replace function public.delete_old_player_scores(p_days integer default 60)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from player_scores where created_at < now() - make_interval(days => p_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.delete_old_player_scores(integer) from public, anon, authenticated;
select cron.schedule('delete-old-player-scores', '37 3 * * *', $$select public.delete_old_player_scores(60)$$);
