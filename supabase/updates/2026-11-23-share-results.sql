-- Sharing results openly (no longer a blind test): the shared essay keeps the
-- AI's full feedback, and the teacher who shared it can link their own marks
-- (saved before sharing) to it, so everyone sees all the marks so far.
alter table public.shared_essays add column if not exists feedback jsonb;

create policy "Teachers can link their own calibration marks"
  on public.calibration_marks for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
