-- Classes everywhere (27 Nov 2026): a quiz week and a game's scores can
-- belong to one of the teacher's classes, so each class has its own
-- leaderboard. Live sessions keep their class as a flag ("class:<id>").

alter table public.quiz_sets
  add column if not exists class_id uuid references public.classes (id) on delete set null;

alter table public.player_scores
  add column if not exists class_id uuid references public.classes (id) on delete set null;

create index if not exists player_scores_class_idx on public.player_scores (host_id, class_id, created_at desc);
