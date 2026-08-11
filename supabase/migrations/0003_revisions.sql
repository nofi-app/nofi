-- nofi schema v3: revision history.
-- Snapshots of note content, encrypted like items.

create table if not exists public.revisions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id uuid not null,
  encrypted_content text not null,
  created_at timestamptz not null default now()
);

create index if not exists revisions_note_idx
  on public.revisions (user_id, note_id, created_at);

alter table public.revisions enable row level security;

drop policy if exists "revisions own" on public.revisions;
create policy "revisions own" on public.revisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
