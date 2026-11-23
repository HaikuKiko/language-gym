-- Class sets: a teacher uploads a scan (or photos) of a class's writing, one
-- page per student. Each page is read, given General English feedback, and
-- saved under the student's name, so each student's progress (overall and
-- per area: Content, Organisation, Grammar, Vocabulary) can be charted later.
-- Teachers have no accounts yet, so a class set belongs to the device (the
-- anonymous user) that made it.

create table if not exists public.class_sets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  title text not null default '',
  class_name text not null default '',
  level text not null check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  task text not null default '',
  grammar_focus text not null default '',
  file_name text not null default '',
  page_count integer not null default 0
);

create table if not exists public.class_set_pages (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.class_sets (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  page_number integer not null,
  -- The student's name as shown, and the same in lower case: the key for progress.
  student_name text not null default '',
  student_key text not null default '',
  photo_path text not null default '',
  status text not null default 'waiting' check (status in ('waiting', 'reading', 'marking', 'done', 'error')),
  error text,
  transcript text,
  sheet jsonb,
  feedback jsonb,
  cefr_level text,
  -- The AI's level per area: { "Content": "A2", "Organisation": "A1", ... }.
  area_levels jsonb,
  updated_at timestamptz not null default now(),
  unique (set_id, page_number)
);

create index if not exists class_sets_created_by_idx on public.class_sets (created_by, created_at desc);
create index if not exists class_set_pages_student_idx on public.class_set_pages (created_by, student_key);

alter table public.class_sets enable row level security;
alter table public.class_set_pages enable row level security;

create policy "Teachers manage their own class sets"
  on public.class_sets for all to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy "Teachers manage their own class set pages"
  on public.class_set_pages for all to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

-- The pages' photos: a private bucket; each teacher's files sit in a folder
-- named after their user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('class-set-photos', 'class-set-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Teachers upload their own class set photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'class-set-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Teachers view their own class set photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'class-set-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
