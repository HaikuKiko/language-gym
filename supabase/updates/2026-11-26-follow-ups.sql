-- Follow-up questions: each speed-friending and custom question can have its
-- own follow-ups (3 each), shown to the asker in "Take turns". Questions with
-- none keep the app's general follow-ups.
alter table public.friending_questions
  add column if not exists follow_ups text[] not null default '{}';
alter table public.custom_questions
  add column if not exists follow_ups text[] not null default '{}';
