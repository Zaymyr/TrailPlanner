insert into storage.buckets (id, name, public)
values ('race-images', 'race-images', true)
on conflict (id) do nothing;

-- Allow public read access
create policy "Public read race images"
  on storage.objects for select
  using (bucket_id = 'race-images');

-- Allow admins to upload/update/delete race images
create policy "Admin write race images"
  on storage.objects for insert
  with check (
    bucket_id = 'race-images'
    and (auth.jwt() ->> 'user_role' = 'admin' or (auth.jwt() -> 'user_roles')::jsonb ? 'admin')
  );

create policy "Admin update race images"
  on storage.objects for update
  using (
    bucket_id = 'race-images'
    and (auth.jwt() ->> 'user_role' = 'admin' or (auth.jwt() -> 'user_roles')::jsonb ? 'admin')
  );

create policy "Admin delete race images"
  on storage.objects for delete
  using (
    bucket_id = 'race-images'
    and (auth.jwt() ->> 'user_role' = 'admin' or (auth.jwt() -> 'user_roles')::jsonb ? 'admin')
  );
