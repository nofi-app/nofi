-- nofi schema v4: share-by-link
-- Encrypted payload only; the share key travels in the URL fragment, never stored.

create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id uuid not null,
  encrypted_payload text not null,
  wrapped_key text not null,
  created_at timestamptz not null default now()
);

alter table public.shares enable row level security;

drop policy if exists "shares own" on public.shares;
create policy "shares own" on public.shares
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Anonymous readers fetch the encrypted payload by token via a
-- security-definer RPC (RLS would otherwise block unauthenticated reads).
create or replace function public.get_share(p_token text)
returns table (encrypted_payload text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select s.encrypted_payload, s.created_at
  from public.shares s
  where s.token = p_token
$$;

revoke all on function public.get_share(text) from public;
grant execute on function public.get_share(text) to anon, authenticated;
