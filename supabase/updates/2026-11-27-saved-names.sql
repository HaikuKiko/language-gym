-- Saved student names (27 Nov 2026): each teacher's students' names (e.g.
-- "Mai T."), so a student types two letters on the join page and taps their
-- name. A name is saved when a student joins, and deleted after 60 days
-- without use (SAVED_NAME_DAYS in src/core/live/saved-names.ts; change both).
create table if not exists public.saved_names (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  last_used_at timestamptz not null default now(),
  unique (host_id, name)
);
alter table public.saved_names enable row level security;
create policy "Teachers read their own saved names"
  on public.saved_names for select to authenticated using (host_id = auth.uid());
create policy "Teachers delete their own saved names"
  on public.saved_names for delete to authenticated using (host_id = auth.uid());

-- Joining (or renaming) saves the name for the session's teacher.
create or replace function public.save_participant_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name !~ '^Guest [0-9]+$' then
    insert into saved_names (host_id, name)
    select s.host_id, new.name from sessions s where s.id = new.session_id
    on conflict (host_id, name) do update set last_used_at = now();
  end if;
  return new;
end;
$$;
drop trigger if exists save_participant_name on public.participants;
create trigger save_participant_name
  after insert or update of name on public.participants
  for each row execute function public.save_participant_name();

-- The join page: names saved by this session's teacher that start with the
-- letters typed (at least 2).
create or replace function public.saved_names_for_code(p_code text, p_prefix text)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select n.name
  from saved_names n
  join sessions s on s.host_id = n.host_id
  where s.code = p_code
    and s.status <> 'finished'
    and char_length(trim(p_prefix)) >= 2
    and lower(n.name) like replace(replace(replace(lower(trim(p_prefix)), '\', ''), '%', ''), '_', '\_') || '%'
  order by n.name
  limit 8;
$$;
revoke all on function public.saved_names_for_code(text, text) from public;
grant execute on function public.saved_names_for_code(text, text) to authenticated;

-- Every night: names not used for 60 days are deleted.
create or replace function public.delete_old_saved_names(p_days integer default 60)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from saved_names where last_used_at < now() - make_interval(days => p_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.delete_old_saved_names(integer) from public, anon, authenticated;
select cron.schedule('delete-old-saved-names', '27 3 * * *', $$select public.delete_old_saved_names(60)$$);
