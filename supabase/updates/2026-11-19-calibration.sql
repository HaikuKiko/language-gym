-- Ongoing IELTS calibration: after "Mark an IELTS essay", a teacher can add
-- the bands they would give. Each row keeps the essay, the question, the AI's
-- bands and the teacher's bands, so the Calibration screen can show how far
-- the AI is from the teachers, and old essays can be re-marked later.
--
-- Run once in the Supabase SQL editor.

create table if not exists public.calibration_marks (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
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
  teacher_tr smallint not null check (teacher_tr between 0 and 9),
  teacher_cc smallint not null check (teacher_cc between 0 and 9),
  teacher_lr smallint not null check (teacher_lr between 0 and 9),
  teacher_gra smallint not null check (teacher_gra between 0 and 9),
  teacher_overall numeric(3, 1) not null
);

create index if not exists calibration_marks_created_idx on public.calibration_marks (created_at desc);

alter table public.calibration_marks enable row level security;

-- Prototype: anyone signed in (teachers use the app without an account) can
-- add marks and see everyone's, so the check covers every teacher's marks.
drop policy if exists "Signed-in users can add calibration marks" on public.calibration_marks;
create policy "Signed-in users can add calibration marks"
  on public.calibration_marks for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Signed-in users can read calibration marks" on public.calibration_marks;
create policy "Signed-in users can read calibration marks"
  on public.calibration_marks for select to authenticated
  using (true);

drop policy if exists "Teachers can delete their own calibration marks" on public.calibration_marks;
create policy "Teachers can delete their own calibration marks"
  on public.calibration_marks for delete to authenticated
  using (user_id = (select auth.uid()));
