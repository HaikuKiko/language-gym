-- IELTS class sets: a class is General English or IELTS Writing Task 2.
-- An IELTS class has a target band (its target_level is not used and is
-- left at 'B2'); its class sets are marked with IELTS bands, and each
-- student's overall band is kept on their first page.

alter table public.classes
  add column if not exists course text not null default 'general' check (course in ('general', 'ielts')),
  add column if not exists target_band numeric(2,1) check (target_band between 0 and 9);

alter table public.class_sets
  add column if not exists course text not null default 'general' check (course in ('general', 'ielts'));

alter table public.class_set_pages
  add column if not exists band numeric(2,1) check (band between 0 and 9);
