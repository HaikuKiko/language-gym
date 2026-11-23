-- Class writing: the teacher's classes (3A, 3B …) with a target level, and
-- the students in each class. Every class set belongs to a class, and every
-- page is linked to a student, so each student's writing can be followed
-- over time. Like class sets, these belong to the teacher's user (a saved
-- account follows the teacher across devices).

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 40),
  -- The level the class is working towards, e.g. "A2+".
  target_level text not null check (target_level in ('A1', 'A1+', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C2'))
);

create unique index if not exists classes_name_idx on public.classes (created_by, lower(name));

create table if not exists public.class_students (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 80),
  student_key text not null,
  unique (class_id, student_key)
);

alter table public.class_sets add column if not exists class_id uuid references public.classes (id) on delete set null;
alter table public.class_set_pages add column if not exists student_id uuid references public.class_students (id) on delete set null;

create index if not exists class_sets_class_idx on public.class_sets (class_id, created_at desc);
create index if not exists class_set_pages_student_id_idx on public.class_set_pages (student_id);

alter table public.classes enable row level security;
alter table public.class_students enable row level security;

create policy "Teachers manage their own classes"
  on public.classes for all to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy "Teachers manage their own students"
  on public.class_students for all to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
