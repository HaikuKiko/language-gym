-- Deletes everything the load test made (scripts/load-test.mjs):
-- its sessions (their pretend students go with them) and the pretend guest
-- logins, which are marked with load_test = true.
delete from public.sessions where 'load-test' = any (categories);
delete from auth.users where is_anonymous and raw_user_meta_data ->> 'load_test' = 'true';
