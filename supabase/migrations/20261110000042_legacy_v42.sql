-- BET-176 : conserver le personnage choisi avant la confirmation email.
-- Après V41. Les métadonnées sont non fiables : validation et options gratuites seulement.
begin;
create or replace function public.creer_profil_inscription()
returns trigger language plpgsql security definer set search_path = public as $$
declare meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); couleur text; visage text; accessoire text; cfg jsonb;
begin
  couleur := case when meta->>'avatar' in ('lime','blue','purple','orange') then meta->>'avatar' else 'lime' end;
  visage := case when meta->>'face' in ('smile','cool','focused','wink') then meta->>'face' else 'smile' end;
  accessoire := case when meta->>'accessory' in ('none','glasses','cap','crown') then meta->>'accessory' else 'none' end;
  cfg := jsonb_build_object('avatar', couleur, 'face', visage, 'accessory', accessoire);
  if meta->'avatar2'->>'v' = '2' and public.avatar_config_valid(meta->'avatar2') then
    if cardinality(public.avatar_item_ids(meta->'avatar2')) = 0 then
      cfg := jsonb_set(meta->'avatar2', '{rev}', '0'::jsonb);
      couleur := case cfg->'kit'->>'item' when 'start-blue' then 'blue' when 'start-purple' then 'purple' when 'start-orange' then 'orange' else 'lime' end;
    end if;
  end if;
  insert into public.profiles (user_id, nickname, avatar, avatar_config)
  values (new.id, public.pseudo_libre(meta->>'username'), couleur, cfg)
  on conflict (user_id) do nothing;
  return new;
exception when others then
  raise warning 'Profil non créé pour %: %', new.id, sqlerrm;
  return new;
end $$;
revoke all on function public.creer_profil_inscription() from public;
-- Le déclencheur auth.users existant utilise cette fonction, sans écriture après confirmation.
notify pgrst, 'reload schema';
commit;
