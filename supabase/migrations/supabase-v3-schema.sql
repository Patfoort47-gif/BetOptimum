-- Extension V3 : profils publics nécessaires aux classements communautaires.
-- À exécuter une fois dans le SQL Editor Supabase après supabase-schema.sql.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default 'Parieur' check (char_length(nickname) between 1 and 24),
  avatar text not null default 'lime' check (avatar in ('lime','blue','purple','orange')),
  avatar_config jsonb not null default '{"avatar":"lime","face":"smile","accessory":"none"}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  period_stats jsonb not null default '{}'::jsonb,
  challenge_stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists challenge_stats jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists avatar_config jsonb not null default '{"avatar":"lime","face":"smile","accessory":"none"}'::jsonb;

alter table public.profiles enable row level security;
drop policy if exists "Public profiles are readable" on public.profiles;
create policy "Public profiles are readable" on public.profiles for select using (true);
drop policy if exists "Users create their public profile" on public.profiles;
create policy "Users create their public profile" on public.profiles for insert with check (auth.uid() = user_id);
drop policy if exists "Users update their public profile" on public.profiles;
create policy "Users update their public profile" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select on table public.profiles to anon, authenticated;
grant insert, update on table public.profiles to authenticated;
