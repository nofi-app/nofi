-- Nofi schema v2: encrypted file storage
-- Private bucket; object paths are UUIDs, bytes are encrypted before upload.

insert into storage.buckets (id, name, public)
values ('nofi-files', 'nofi-files', false)
on conflict (id) do nothing;

-- Signed-in users can only touch objects they uploaded (owner = auth.uid()).
drop policy if exists "nofi files select own" on storage.objects;
create policy "nofi files select own" on storage.objects
  for select using (bucket_id = 'nofi-files' and auth.uid() = owner);

drop policy if exists "nofi files insert own" on storage.objects;
create policy "nofi files insert own" on storage.objects
  for insert with check (bucket_id = 'nofi-files' and auth.uid() = owner);

drop policy if exists "nofi files update own" on storage.objects;
create policy "nofi files update own" on storage.objects
  for update using (bucket_id = 'nofi-files' and auth.uid() = owner);

drop policy if exists "nofi files delete own" on storage.objects;
create policy "nofi files delete own" on storage.objects
  for delete using (bucket_id = 'nofi-files' and auth.uid() = owner);
