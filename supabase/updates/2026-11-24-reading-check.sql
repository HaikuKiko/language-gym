-- Class sets: the teacher checks each student's reading (guessed words in
-- yellow) before marking, and can correct it.
alter table public.class_set_pages add column if not exists edited_text text;
alter table public.class_set_pages add column if not exists reading_checked boolean not null default false;
comment on column public.class_set_pages.edited_text is 'On a student''s first page: the whole writing as corrected by the teacher (null = as read from the pages).';
comment on column public.class_set_pages.reading_checked is 'On a student''s first page: the teacher has checked the reading against the paper.';
