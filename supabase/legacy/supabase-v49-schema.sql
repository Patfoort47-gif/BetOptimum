-- BET-198 : retrait H1, après V48. Aucun historique supprimé.
begin;
create or replace function public.reject_new_half_time_bets()
returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from jsonb_array_elements(new.selections) s where s->>'key' ~ '^h1') then
  raise exception 'MARCHE_INDISPONIBLE: première mi-temps retirée';
 end if;
 return new;
end $$;
drop trigger if exists bets_reject_new_half_time on public.bets;
create trigger bets_reject_new_half_time before insert on public.bets for each row execute function public.reject_new_half_time_bets();
commit;
