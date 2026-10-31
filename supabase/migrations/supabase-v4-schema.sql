-- Extension V4 : annuaire fiable des joueurs (BET-45).
-- À exécuter dans le SQL Editor Supabase après supabase-schema.sql et supabase-v3-schema.sql. Réexécutable.
-- Crée un profil public pour chaque compte (à l'inscription et pour les comptes existants) et rend le pseudo unique.
do $$ begin
  if to_regclass('public.profiles') is null then
    raise exception 'La table public.profiles est absente : exécutez d''abord supabase-v3-schema.sql.';
  end if;
end $$;

alter table public.profiles add column if not exists avatar_config jsonb not null default '{"avatar":"lime","face":"smile","accessory":"none"}'::jsonb;
alter table public.profiles add column if not exists challenge_stats jsonb not null default '{}'::jsonb;

-- Pseudo valide : 3 à 24 caractères, mêmes caractères que le formulaire d'inscription.
create or replace function public.pseudo_valide(p_nickname text)
returns boolean language sql immutable as $$
  select p_nickname is not null and p_nickname ~ '^[A-Za-zÀ-ÿ0-9_. -]{3,24}$' and btrim(p_nickname) = p_nickname
$$;

-- Dédoublonnage préalable : le plus ancien profil garde son pseudo, les autres reçoivent un suffixe numérique.
do $$
declare r record; candidate text; n int;
begin
  for r in
    select user_id, nickname from (
      select user_id, nickname, row_number() over (partition by lower(nickname) order by updated_at, user_id) as rang
      from public.profiles
    ) t where rang > 1
  loop
    n := 2;
    loop
      candidate := left(r.nickname, 24 - length(n::text)) || n::text;
      exit when not exists (select 1 from public.profiles where lower(nickname) = lower(candidate));
      n := n + 1;
    end loop;
    update public.profiles set nickname = candidate where user_id = r.user_id;
  end loop;
end $$;

create unique index if not exists profiles_nickname_lower_key on public.profiles (lower(nickname));

-- Pseudo libre, comparé sans tenir compte de la casse. Appelable avant l'inscription (rôle anon) ;
-- le pseudo du joueur connecté reste disponible pour lui-même.
create or replace function public.pseudo_disponible(p_nickname text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pseudo_valide(p_nickname) and not exists (
    select 1 from public.profiles where lower(nickname) = lower(p_nickname) and user_id is distinct from auth.uid()
  )
$$;
revoke all on function public.pseudo_disponible(text) from public;
grant execute on function public.pseudo_disponible(text) to anon, authenticated;

-- Pseudo libre construit à partir d'un souhait : le souhait s'il est valide et libre, sinon « Parieur » suivi de 4 chiffres.
create or replace function public.pseudo_libre(p_souhait text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare candidate text := nullif(btrim(coalesce(p_souhait, '')), '');
begin
  if candidate is not null and public.pseudo_valide(candidate)
     and not exists (select 1 from public.profiles where lower(nickname) = lower(candidate)) then
    return candidate;
  end if;
  loop
    candidate := 'Parieur' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.profiles where lower(nickname) = lower(candidate));
  end loop;
  return candidate;
end $$;
revoke all on function public.pseudo_libre(text) from public;

-- Profil créé avec le compte. Une erreur ici ne doit jamais empêcher l'inscription.
create or replace function public.creer_profil_inscription()
returns trigger language plpgsql security definer set search_path = public as $$
declare meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); couleur text; visage text; accessoire text;
begin
  couleur := case when meta->>'avatar' in ('lime','blue','purple','orange') then meta->>'avatar' else 'lime' end;
  visage := case when meta->>'face' in ('smile','cool','focused','wink') then meta->>'face' else 'smile' end;
  accessoire := case when meta->>'accessory' in ('none','glasses','cap','crown') then meta->>'accessory' else 'none' end;
  insert into public.profiles (user_id, nickname, avatar, avatar_config)
  values (new.id, public.pseudo_libre(meta->>'username'), couleur,
          jsonb_build_object('avatar', couleur, 'face', visage, 'accessory', accessoire))
  on conflict (user_id) do nothing;
  return new;
exception when others then
  raise warning 'Profil non créé pour %: %', new.id, sqlerrm;
  return new;
end $$;
revoke all on function public.creer_profil_inscription() from public;

drop trigger if exists creer_profil_inscription on auth.users;
create trigger creer_profil_inscription after insert on auth.users
for each row execute function public.creer_profil_inscription();

-- Reprise des comptes existants sans profil (un par un, pour que l'unicité du pseudo reste garantie).
do $$
declare u record; meta jsonb; couleur text; visage text; accessoire text;
begin
  for u in
    select au.id, coalesce(au.raw_user_meta_data, '{}'::jsonb) as meta
    from auth.users au left join public.profiles p on p.user_id = au.id
    where p.user_id is null
  loop
    meta := u.meta;
    couleur := case when meta->>'avatar' in ('lime','blue','purple','orange') then meta->>'avatar' else 'lime' end;
    visage := case when meta->>'face' in ('smile','cool','focused','wink') then meta->>'face' else 'smile' end;
    accessoire := case when meta->>'accessory' in ('none','glasses','cap','crown') then meta->>'accessory' else 'none' end;
    insert into public.profiles (user_id, nickname, avatar, avatar_config)
    values (u.id, public.pseudo_libre(meta->>'username'), couleur,
            jsonb_build_object('avatar', couleur, 'face', visage, 'accessory', accessoire))
    on conflict (user_id) do nothing;
  end loop;
end $$;

-- Diagnostic à lancer à la main : comptes sans profil (doit renvoyer 0).
-- select count(*) from auth.users u left join public.profiles p on p.user_id = u.id where p.user_id is null;
