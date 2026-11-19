-- ---------------------------------------------------------------------------
-- The teacher sets the writing question; only saved accounts get a record
-- ---------------------------------------------------------------------------
-- Additive only. Safe to run again.
--
-- To set this week's IELTS question: Table Editor -> writing_prompts, tick
-- "assigned" on the question (untick last week's). Students see every
-- assigned question for their course, newest first.

alter table public.writing_prompts
  add column if not exists assigned boolean not null default false,
  add column if not exists assigned_at timestamptz;

create index if not exists writing_prompts_assigned_idx
  on public.writing_prompts (track_id, assigned_at desc) where assigned;

-- Fills in assigned_at when a question is ticked, so the newest comes first.
create or replace function public.stamp_assigned_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.assigned and (tg_op = 'INSERT' or not old.assigned) then
    new.assigned_at := now();
  elsif not new.assigned then
    new.assigned_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists writing_prompts_stamp_assigned on public.writing_prompts;
create trigger writing_prompts_stamp_assigned
  before insert or update of assigned on public.writing_prompts
  for each row execute function public.stamp_assigned_at();

-- Start with question 1 (smartphones) set, so the IELTS screen has one.
update public.writing_prompts set assigned = true
where track_id = 'ielts' and topic = 'Technology' and essay_type = 'opinion'
  and not exists (select 1 from public.writing_prompts where track_id = 'ielts' and assigned);

-- Only saved accounts (with an email, not guests) can create a student
-- record, so everyone enrolled on IELTS or B2 First can sign in anywhere.
drop policy if exists "Students can create their own record" on public.students;
create policy "Students can create their own record"
  on public.students for insert to authenticated
  with check (
    id = (select auth.uid())
    and (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
  );
