create table if not exists public.user_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_states enable row level security;

drop policy if exists "Users read their own BetMaster state" on public.user_states;
create policy "Users read their own BetMaster state"
on public.user_states for select
using (auth.uid() = user_id);

drop policy if exists "Users create their own BetMaster state" on public.user_states;
create policy "Users create their own BetMaster state"
on public.user_states for insert
with check (auth.uid() = user_id);

drop policy if exists "Users update their own BetMaster state" on public.user_states;
create policy "Users update their own BetMaster state"
on public.user_states for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on table public.user_states to authenticated;
