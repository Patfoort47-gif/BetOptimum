-- Extension V17 : avatar 3D (BET-49).
-- À exécuter dans le SQL Editor Supabase après supabase-v16-schema.sql. Réexécutable.
-- Contenu : validation stricte de la configuration de l'avatar (fonction appelée par une contrainte, mêmes règles que avatar-config.js),
-- contrôle de possession des objets de la boutique à chaque enregistrement, nettoyage automatique quand un objet est revendu ou une division perdue,
-- migration des anciens avatars, seau de stockage public « avatars » (buste et en pied, écriture réservée au propriétaire).
do $$ begin
  if to_regclass('public.inventories') is null or to_regclass('public.player_unlocks') is null then
    raise exception 'Exécutez d''abord supabase-v16-schema.sql.';
  end if;
end $$;

create or replace function public.avatar_int(v jsonb, lo bigint, hi bigint)
returns boolean language sql immutable as $$
  select coalesce(jsonb_typeof(v) = 'number' and v::text ~ '^[0-9]{1,10}$' and (v::text)::bigint between lo and hi, false)
$$;

-- Zone occupée par un accessoire : une seule pièce par zone.
create or replace function public.avatar_slot(item text)
returns text language sql immutable as $$
  select case item when 'acc-captain' then 'arm' when 'acc-cap' then 'head' when 'acc-headband' then 'head' when 'acc-crown' then 'head' when 'acc-glasses' then 'face' when 'acc-headphones' then 'ears' when 'acc-scarf' then 'neck' end
$$;

create or replace function public.avatar_config_valid(cfg jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare kit jsonb;
begin
  if cfg is null or jsonb_typeof(cfg) <> 'object' or length(cfg::text) > 1500 then return false; end if;
  -- Ancien avatar (couleur, expression, accessoire).
  if not (cfg ? 'v') or cfg->>'v' = '1' then
    return coalesce(cfg->>'avatar' in ('lime','blue','purple','orange') and cfg->>'face' in ('smile','cool','focused','wink') and cfg->>'accessory' in ('none','glasses','cap','crown'), false);
  end if;
  if cfg->>'v' <> '2' then return false; end if;
  if exists (select 1 from jsonb_object_keys(cfg) k where k not in ('v','body','skin','face','eyes','expression','hair','hairColor','kit','boots','pose','accessories','base','background','showcase','celebration','rev')) then return false; end if;
  if not (public.avatar_int(cfg->'skin', 0, 4) and public.avatar_int(cfg->'face', 0, 5) and public.avatar_int(cfg->'eyes', 0, 5) and public.avatar_int(cfg->'hair', 0, 11)
    and public.avatar_int(cfg->'hairColor', 0, 8) and public.avatar_int(cfg->'boots', 0, 3) and public.avatar_int(cfg->'rev', 0, 4294967295)) then return false; end if;
  if not (coalesce(jsonb_typeof(cfg->'body') = 'string' and cfg->>'body' in ('m','f'), false)
    and coalesce(jsonb_typeof(cfg->'expression') = 'string' and cfg->>'expression' in ('smile','focus','wink','confident','joy','surprise'), false)
    and coalesce(jsonb_typeof(cfg->'pose') = 'string' and cfg->>'pose' in ('idle','arms','ball','foot'), false)
    and coalesce(jsonb_typeof(cfg->'base') = 'string' and cfg->>'base' in ('base-classic','base-grass','base-silver','base-gold','base-neon'), false)
    and coalesce(jsonb_typeof(cfg->'celebration') = 'string' and cfg->>'celebration' in ('celeb-jump','celeb-fist','celeb-slide','celeb-flip'), false)
    and coalesce(jsonb_typeof(cfg->'background') = 'string' and (cfg->>'background' ~ '^solid-[0-5]$' or cfg->>'background' in ('bg-training','bg-lockers','bg-tunnel')
      or cfg->>'background' ~ '^bg-(rio|barcelona|madrid|paris|munich|london)-(in|out)$'), false)) then return false; end if;
  kit := cfg->'kit';
  if jsonb_typeof(kit) <> 'object' or exists (select 1 from jsonb_object_keys(kit) k where k not in ('item','number','name')) then return false; end if;
  if not (coalesce(jsonb_typeof(kit->'item') = 'string' and kit->>'item' in ('start-lime','start-blue','start-purple','start-orange','kit-plain-lime','kit-plain-blue','kit-plain-red','kit-plain-white','kit-plain-black','kit-plain-orange','kit-stripe-vertical','kit-stripe-band','kit-stripe-hoops','kit-stripe-scarf','kit-retro-70','kit-retro-90','kit-retro-champion','kit-champion','kit-gold'), false)
    and (kit->'number' is null or jsonb_typeof(kit->'number') = 'null' or public.avatar_int(kit->'number', 0, 99))
    and coalesce(jsonb_typeof(kit->'name') = 'string' and kit->>'name' ~ '^[A-Z0-9 .-]{0,12}$', false)) then return false; end if;
  if jsonb_typeof(cfg->'accessories') <> 'array' or jsonb_array_length(cfg->'accessories') > 5 then return false; end if;
  if exists (select 1 from jsonb_array_elements(cfg->'accessories') e where jsonb_typeof(e) <> 'string' or public.avatar_slot(e #>> '{}') is null) then return false; end if;
  if (select count(*) from jsonb_array_elements_text(cfg->'accessories')) <> (select count(distinct public.avatar_slot(e)) from jsonb_array_elements_text(cfg->'accessories') e) then return false; end if;
  if jsonb_typeof(cfg->'showcase') <> 'array' or jsonb_array_length(cfg->'showcase') > 3 then return false; end if;
  if exists (select 1 from jsonb_array_elements(cfg->'showcase') e where jsonb_typeof(e) <> 'string' or (e #>> '{}') not in ('trophy-cup','trophy-pichichi','trophy-boot','trophy-glove','trophy-ball')) then return false; end if;
  if (select count(*) from jsonb_array_elements_text(cfg->'showcase')) <> (select count(distinct e) from jsonb_array_elements_text(cfg->'showcase') e) then return false; end if;
  return true;
end $$;

-- Les avatars invalides déjà enregistrés reviennent à l'avatar par défaut avant la pose de la contrainte.
update public.profiles set avatar_config = '{"avatar":"lime","face":"smile","accessory":"none"}'::jsonb where not public.avatar_config_valid(avatar_config);
alter table public.profiles drop constraint if exists profiles_avatar_valid;
alter table public.profiles add constraint profiles_avatar_valid check (public.avatar_config_valid(avatar_config));

-- Objets qui demandent une possession : tout ce qui n'est pas gratuit (maillots de départ, socle classique, fonds unis, saut de joie).
create or replace function public.avatar_item_ids(cfg jsonb)
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct id) filter (where id is not null), '{}'::text[]) from (
    select case when cfg->'kit'->>'item' like 'start-%' then null else cfg->'kit'->>'item' end as id
    union all select e from jsonb_array_elements_text(coalesce(cfg->'accessories', '[]'::jsonb)) e
    union all select case when cfg->>'base' = 'base-classic' then null else cfg->>'base' end
    union all select case when cfg->>'background' like 'solid-%' then null else cfg->>'background' end
    union all select e from jsonb_array_elements_text(coalesce(cfg->'showcase', '[]'::jsonb)) e
    union all select case when cfg->>'celebration' = 'celeb-jump' then null else cfg->>'celebration' end
    union all select case when cfg->>'hairColor' = '8' then 'hair-lime' end
  ) t(id)
$$;
-- Éléments débloqués par une division (table player_unlocks) et l'identifiant d'avatar correspondant.
create or replace function public.avatar_unlock_id(item text)
returns text language sql immutable as $$
  select case item when 'socle argent' then 'base-silver' when 'maillot or' then 'kit-gold' when 'cheveux vert citron' then 'hair-lime' when 'couronne' then 'acc-crown' end
$$;

-- Un avatar ne porte que ce que le joueur possède (boutique) ou a débloqué (division) : vérifié à chaque enregistrement, jamais seulement par le navigateur.
create or replace function public.profiles_check_avatar()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_item text;
begin
  if tg_op = 'UPDATE' and new.avatar_config is not distinct from old.avatar_config then return new; end if;
  if not public.avatar_config_valid(new.avatar_config) then raise exception 'AVATAR_INVALIDE'; end if;
  if new.avatar_config->>'v' is distinct from '2' then return new; end if;
  foreach v_item in array public.avatar_item_ids(new.avatar_config) loop
    if not exists (select 1 from public.inventories i where i.user_id = new.user_id and i.item_id = v_item)
       and not exists (select 1 from public.player_unlocks u where u.user_id = new.user_id and public.avatar_unlock_id(u.item) = v_item) then
      raise exception 'OBJET_ABSENT: %', v_item;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists profiles_check_avatar on public.profiles;
create trigger profiles_check_avatar before insert or update of avatar_config on public.profiles for each row execute function public.profiles_check_avatar();

-- Retire d'un avatar des objets qui ne sont plus à son joueur (revente, division perdue).
create or replace function public.avatar_strip(p_user uuid, p_ids text[])
returns void language plpgsql security definer set search_path = public as $$
declare cfg jsonb;
begin
  select avatar_config into cfg from public.profiles where user_id = p_user;
  if cfg is null or cfg->>'v' is distinct from '2' then return; end if;
  if cfg->'kit'->>'item' = any(p_ids) then cfg := jsonb_set(cfg, '{kit,item}', '"start-lime"'::jsonb); end if;
  cfg := jsonb_set(cfg, '{accessories}', coalesce((select jsonb_agg(e) from jsonb_array_elements_text(cfg->'accessories') e where e <> all(p_ids)), '[]'::jsonb));
  cfg := jsonb_set(cfg, '{showcase}', coalesce((select jsonb_agg(e) from jsonb_array_elements_text(cfg->'showcase') e where e <> all(p_ids)), '[]'::jsonb));
  if cfg->>'base' = any(p_ids) then cfg := jsonb_set(cfg, '{base}', '"base-classic"'::jsonb); end if;
  if cfg->>'background' = any(p_ids) then cfg := jsonb_set(cfg, '{background}', '"solid-1"'::jsonb); end if;
  if cfg->>'celebration' = any(p_ids) then cfg := jsonb_set(cfg, '{celebration}', '"celeb-jump"'::jsonb); end if;
  if cfg->>'hairColor' = '8' and 'hair-lime' = any(p_ids) then cfg := jsonb_set(cfg, '{hairColor}', '1'::jsonb); end if;
  update public.profiles set avatar_config = cfg where user_id = p_user and avatar_config is distinct from cfg;
end $$;
revoke all on function public.avatar_strip(uuid, text[]) from public, anon, authenticated;

create or replace function public.inventories_strip_avatar()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.avatar_strip(old.user_id, array[old.item_id]); return old; end $$;
drop trigger if exists inventories_strip_avatar on public.inventories;
create trigger inventories_strip_avatar after delete on public.inventories for each row execute function public.inventories_strip_avatar();

create or replace function public.unlocks_strip_avatar()
returns trigger language plpgsql security definer set search_path = public as $$
declare id text := public.avatar_unlock_id(old.item);
begin if id is not null then perform public.avatar_strip(old.user_id, array[id]); end if; return old; end $$;
drop trigger if exists unlocks_strip_avatar on public.player_unlocks;
create trigger unlocks_strip_avatar after delete on public.player_unlocks for each row execute function public.unlocks_strip_avatar();

-- Migration des anciens avatars : lunettes et casquette deviennent les objets équivalents de la boutique, offerts ; la couronne n'est conservée que par un Master (déblocage).
insert into public.shop_items (id, category, name, rarity, price, collection) values
  ('acc-glasses', 'accessory', 'Lunettes', 'common', 600, 'tribune'), ('acc-cap', 'accessory', 'Casquette', 'common', 400, 'tribune') on conflict (id) do nothing;
insert into public.inventories (user_id, item_id, price_paid)
select p.user_id, case p.avatar_config->>'accessory' when 'glasses' then 'acc-glasses' else 'acc-cap' end, 0 from public.profiles p
where not (p.avatar_config ? 'v') and p.avatar_config->>'accessory' in ('glasses', 'cap') on conflict do nothing;

-- Stockage des images de l'avatar : seau public (lecture par adresse), écriture réservée au propriétaire dans son dossier, deux fichiers (bust, full), 1,5 Mo au plus.
do $$ begin
  if to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('avatars', 'avatars', true, 1500000, array['image/webp', 'image/jpeg', 'image/png'])
      on conflict (id) do update set public = true, file_size_limit = 1500000, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];
    drop policy if exists "Avatar images select" on storage.objects;
    drop policy if exists "Avatar images insert" on storage.objects;
    drop policy if exists "Avatar images update" on storage.objects;
    drop policy if exists "Avatar images delete" on storage.objects;
    create policy "Avatar images select" on storage.objects for select to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
    create policy "Avatar images insert" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and name in (auth.uid()::text || '/bust', auth.uid()::text || '/full'));
    create policy "Avatar images update" on storage.objects for update to authenticated using (bucket_id = 'avatars' and name in (auth.uid()::text || '/bust', auth.uid()::text || '/full')) with check (bucket_id = 'avatars' and name in (auth.uid()::text || '/bust', auth.uid()::text || '/full'));
    create policy "Avatar images delete" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;

revoke all on function public.avatar_item_ids(jsonb), public.avatar_unlock_id(text) from public, anon;
grant execute on function public.avatar_config_valid(jsonb), public.avatar_int(jsonb, bigint, bigint), public.avatar_slot(text) to anon, authenticated;
