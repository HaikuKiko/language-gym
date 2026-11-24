-- Deleting a class set: its pages go with it (on delete cascade); teachers may
-- also delete their own scanned page photos.
create policy "Teachers delete their own class set photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'class-set-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
