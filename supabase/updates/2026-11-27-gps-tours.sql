-- GPS tours, live (27 Nov 2026).
-- Under-18 groups share their NEWEST place with the supervising adults during a
-- tour: one value per phone, overwritten (no trail), cleared when the tour ends.
alter table public.participants add column if not exists live_place jsonb;
-- The teacher's own newest place (for the "within sight of an adult" rule).
alter table public.sessions add column if not exists host_place jsonb;

-- The host ends a tour: everyone's place is cleared.
create or replace function public.clear_tour_places(p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update participants set live_place = null
   where session_id = p_session_id
     and exists (select 1 from sessions s where s.id = p_session_id and s.host_id = auth.uid());
  update sessions set host_place = null where id = p_session_id and host_id = auth.uid();
$$;
revoke all on function public.clear_tour_places(uuid) from public;
grant execute on function public.clear_tour_places(uuid) to authenticated;

-- Photos and recordings from a tour, private. Paths: <session id>/<who>/<file>.
-- Only the session's host and students can add or see them.
insert into storage.buckets (id, name, public, file_size_limit)
values ('tour-media', 'tour-media', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "Tour media: session members add" on storage.objects;
create policy "Tour media: session members add"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tour-media' and public.can_see_session(((storage.foldername(name))[1])::uuid));

drop policy if exists "Tour media: session members read" on storage.objects;
create policy "Tour media: session members read"
  on storage.objects for select to authenticated
  using (bucket_id = 'tour-media' and public.can_see_session(((storage.foldername(name))[1])::uuid));
