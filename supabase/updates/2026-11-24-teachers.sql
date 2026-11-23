-- Teacher logins: a teacher signs in with a username and password (a made-up
-- login email username@teachers.language-gym.invalid, so no email is sent).
-- The first teacher account is created by the owner; after that only
-- teachers can add teachers (the teacher-account edge function).
-- Class writing (classes, students, marked writing, page photos) is for
-- teachers only: restrictive policies add "and is a teacher" to the existing
-- "only your own" policies.

create table if not exists public.teachers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

alter table public.teachers enable row level security;

-- Teachers can see the list of teachers; changes go through the edge function.
-- True when the signed-in user is a teacher.
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.teachers where user_id = auth.uid());
$$;

-- How many teachers there are (the app offers "create the first teacher" only when 0).
create or replace function public.teacher_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.teachers;
$$;

grant execute on function public.is_teacher() to anon, authenticated;
grant execute on function public.teacher_count() to anon, authenticated;

-- Teachers can see the list of teachers; changes go through the edge function.
create policy "Teachers can see the teachers"
  on public.teachers for select to authenticated
  using ((select public.is_teacher()));

create policy "Only teachers: classes"
  on public.classes as restrictive for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));

create policy "Only teachers: class students"
  on public.class_students as restrictive for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));

create policy "Only teachers: class sets"
  on public.class_sets as restrictive for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));

create policy "Only teachers: class set pages"
  on public.class_set_pages as restrictive for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));

-- The class writing photos, too (other buckets are not affected).
create policy "Only teachers: class set photos"
  on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'class-set-photos' or (select public.is_teacher()))
  with check (bucket_id <> 'class-set-photos' or (select public.is_teacher()));
