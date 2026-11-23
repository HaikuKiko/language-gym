-- Sharing a marked essay with other teachers for calibration. A teacher who
-- has marked an essay makes a link (/calibrate/<code>); other teachers open it,
-- give their own bands without seeing the AI's, and their marks are saved in
-- calibration_marks with the code. Links do not expire; nothing is deleted.

create table if not exists public.shared_essays (
  code text primary key check (code ~ '^[A-Z2-9]{6,12}$'),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  question text not null default '',
  essay text not null,
  word_count integer not null,
  model text,
  ai_tr smallint not null check (ai_tr between 0 and 9),
  ai_cc smallint not null check (ai_cc between 0 and 9),
  ai_lr smallint not null check (ai_lr between 0 and 9),
  ai_gra smallint not null check (ai_gra between 0 and 9),
  ai_overall numeric(3, 1) not null,
  -- Paths in the shared-essay-photos storage bucket, page 1 first.
  photo_paths text[] not null default '{}'
);

alter table public.shared_essays enable row level security;

-- Prototype: anyone signed in (teachers use the app without an account) can
-- share an essay, and anyone with the link can open it.
create policy "Signed-in users can share essays"
  on public.shared_essays for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "Signed-in users can open shared essays"
  on public.shared_essays for select to authenticated
  using (true);

-- Which shared essay a calibration mark is for (empty for the teacher's own).
alter table public.calibration_marks
  add column if not exists shared_code text references public.shared_essays (code);

create index if not exists calibration_marks_shared_idx on public.calibration_marks (shared_code);

-- The photos of the pages: a private bucket, readable by signed-in users only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shared-essay-photos', 'shared-essay-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Signed-in users can upload shared essay photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'shared-essay-photos');

create policy "Signed-in users can view shared essay photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'shared-essay-photos');
