-- Saved results, so sending the same writing (or the same photo) again shows
-- the earlier feedback instead of asking Claude again and using up a check.
-- Only the server function reads and writes it (RLS on, no policies). Rows
-- older than CACHE_DAYS (see assess-writing/index.ts) are ignored and deleted.
create table if not exists public.response_cache (
  key text primary key,          -- a fingerprint of the request, not the writing itself
  kind text not null,            -- feedback, ielts, ielts_teacher or transcribe
  response jsonb not null,       -- the feedback or photo reading that was sent back
  created_at timestamptz not null default now()
);

create index if not exists response_cache_created_idx on public.response_cache (created_at);

alter table public.response_cache enable row level security;
