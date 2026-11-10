-- BET-309 : après V63. Bloque aussi les clients historiques ; aucun solde modifié.
begin;
create or replace function public.add_capital(p_amount numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 raise exception 'AJOUT_CAPITAL_DESACTIVE';
end $$;
revoke all on function public.add_capital(numeric) from public,anon,authenticated,service_role;
comment on function public.add_capital(numeric) is 'BET-309 : ancien ajout libre désactivé. Aucun crédit, même pour les anciens clients.';
notify pgrst,'reload schema';
commit;
