-- Privacy: only the host and the students in a session can read it and its
-- names (before, any signed-in user could read every session's names).
-- Restrictive policies narrow the older "Signed-in users can read ..." ones.
create or replace function public.can_see_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from sessions s where s.id = p_session_id and s.host_id = auth.uid())
      or exists (select 1 from participants p where p.session_id = p_session_id and p.user_id = auth.uid());
$$;
revoke all on function public.can_see_session(uuid) from public;
grant execute on function public.can_see_session(uuid) to authenticated;

-- (host_id / user_id checked directly too: a row being inserted is not yet
-- visible to the function, e.g. when a host creates a session.)
create policy "Only the host and its students: sessions"
  on public.sessions as restrictive for select to authenticated
  using (host_id = auth.uid() or public.can_see_session(id));
create policy "Only the host and its students: participants"
  on public.participants as restrictive for select to authenticated
  using (user_id = auth.uid() or public.can_see_session(session_id));

-- Joining: find a session by its code (before being in it).
create or replace function public.session_by_code(p_code text)
returns setof public.sessions
language sql
stable
security definer
set search_path = public
as $$
  select * from sessions where code = p_code limit 1;
$$;
revoke all on function public.session_by_code(text) from public;
grant execute on function public.session_by_code(text) to authenticated;
