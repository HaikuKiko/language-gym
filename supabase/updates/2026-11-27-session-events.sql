-- Things that happen in a live session, one row each, for awards and results
-- afterwards (word games: words guessed/skipped, hints; later Talk Rounds
-- follow-up questions). Shared by every live game. Deleted with the session.
create table if not exists public.session_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions (id) on delete cascade,
  -- Who did it (null: the host, or nobody in particular).
  participant_id uuid references public.participants (id) on delete set null,
  -- e.g. 'game_started', 'card_done', 'hint', 'follow_up_asked'.
  kind text not null check (char_length(kind) between 1 and 40),
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists session_events_session_id_idx on public.session_events (session_id, created_at);
alter table public.session_events enable row level security;
grant select, insert on public.session_events to authenticated;

drop policy if exists "Host and students read their session's events" on public.session_events;
create policy "Host and students read their session's events"
  on public.session_events for select to authenticated
  using (public.can_see_session(session_id));

-- A student adds events as themselves; the host adds events with no student
-- or for any student in the session (e.g. marking for a student without a phone).
drop policy if exists "Host and students add events" on public.session_events;
create policy "Host and students add events"
  on public.session_events for insert to authenticated
  with check (
    exists (select 1 from public.sessions s where s.id = session_id and s.host_id = auth.uid())
    or (
      participant_id is not null
      and exists (
        select 1 from public.participants p
        where p.id = participant_id and p.session_id = session_events.session_id and p.user_id = auth.uid()
      )
    )
  );
