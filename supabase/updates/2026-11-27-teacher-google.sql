-- Google sign-in for teachers (27 Nov 2026).
-- Each teacher can have a Gmail address. It becomes their login email, so
-- "Sign in with Google" with that Gmail opens the same teacher account
-- (Supabase links identities with the same confirmed email). The username +
-- password still work: the teacher-account function looks up the email.

alter table public.teachers
  add column if not exists email text unique check (email is null or email = lower(email));

-- The user (if any) whose login email is this one. Only the edge functions use it.
create or replace function public.user_id_for_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke execute on function public.user_id_for_email(text) from public, anon, authenticated;
grant execute on function public.user_id_for_email(text) to service_role;
