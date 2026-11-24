-- Class sets: a student's writing can run over several pages. A page without
-- the printed sheet header continues the student before it.
alter table public.class_set_pages add column if not exists continues_page integer;
comment on column public.class_set_pages.continues_page is 'For a student''s second (third…) page: the page number of their first page. Null on first pages.';
