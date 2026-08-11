-- nofi schema v1
-- Vault: one row per user, stores crypto metadata only (salt + verifier).
-- Everything encrypted lives in items as ciphertext; the server can never read it.

create table if not exists public.vault (
  id uuid primary key references auth.users (id) on delete cascade,
  salt text not null,
  verifier text not null,
  created_at timestamptz not null default now()
);

-- items: notes, tags, folders, and file references all live here (SN-style).
-- encrypted_content is the encrypted JSON blob for the item type.
create table if not exists public.items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content_type text not null,
  encrypted_content text not null,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_user_updated_idx
  on public.items (user_id, updated_at);

-- Row Level Security: a user can only see their own rows.
alter table public.vault enable row level security;
alter table public.items enable row level security;

drop policy if exists "vault own" on public.vault;
create policy "vault own" on public.vault
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "items own" on public.items;
create policy "items own" on public.items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime sync: broadcast item changes to signed-in clients.
alter publication supabase_realtime add table public.items;
