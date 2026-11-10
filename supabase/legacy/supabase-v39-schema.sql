-- BET-163 : effets de victoire, ambiance sonore et personnalisation de la carte joueur. Après V38 (et V16), réexécutable.
-- Les nouveaux objets sont des catégories de la boutique équipées par equipped_items (slot = catégorie, equip_item est générique) :
-- aucune table ni colonne nouvelle, profiles.avatar_config n'est pas modifié.
-- Seuls les objets de la carte joueur (fond, police du numéro, effet brillant) deviennent publics, comme le titre et le cadre ;
-- les effets de victoire et les sons restent privés (equipped_items, lecture par le propriétaire seulement).
do $$ begin
  if to_regclass('public.equipped_items') is null then
    raise exception 'Exécutez d''abord supabase-v16-schema.sql.';
  end if;
end $$;
begin;
-- Emplacements visibles de tous. Sert aussi de sonde à scripts/shop-engine.mjs : les nouveaux objets ne sont vendus qu'une fois V39 appliquée.
create or replace function public.equipped_slot_public(p_slot text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(p_slot in ('title','frame','card-bg','card-font','card-shine'), false)
$$;
revoke all on function public.equipped_slot_public(text) from public;
grant execute on function public.equipped_slot_public(text) to anon, authenticated, service_role;

-- Mêmes colonnes que V16 : seule la liste des emplacements publics change.
create or replace view public.public_equipped as
select e.user_id, e.slot, e.item_id, i.name, i.asset from public.equipped_items e join public.shop_items i on i.id = e.item_id where public.equipped_slot_public(e.slot);
grant select on table public.public_equipped to anon, authenticated;
commit;
