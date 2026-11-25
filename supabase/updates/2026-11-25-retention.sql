-- Sessions (and, with them, their students' names) are deleted after 30 days
-- (RETENTION_DAYS in src/constants/product.ts; change both together).
create extension if not exists pg_cron;

create or replace function public.delete_old_sessions(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from sessions where created_at < now() - make_interval(days => p_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.delete_old_sessions(integer) from public, anon, authenticated;

-- Every night at 03:17 (UTC).
select cron.schedule('delete-old-sessions', '17 3 * * *', $$select public.delete_old_sessions(30)$$);
