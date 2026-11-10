-- BET-260 : visuels publics de coupons, chemins aléatoires sans identifiant de joueur. Après V60.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('ticket-previews','ticket-previews',true,1500000,array['image/png']) on conflict(id) do update set public=true,file_size_limit=1500000,allowed_mime_types=array['image/png'];
drop policy if exists "Ticket previews insert" on storage.objects;
create policy "Ticket previews insert" on storage.objects for insert to authenticated with check(bucket_id='ticket-previews' and name~'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.png$' and owner_id=auth.uid()::text);
drop policy if exists "Ticket previews select" on storage.objects;
create policy "Ticket previews select" on storage.objects for select to authenticated using(bucket_id='ticket-previews' and owner_id=auth.uid()::text);
drop policy if exists "Ticket previews delete" on storage.objects;
create policy "Ticket previews delete" on storage.objects for delete to authenticated using(bucket_id='ticket-previews' and owner_id=auth.uid()::text);
create or replace function public.ticket_preview_cleanup_candidates()
returns table(name text) language sql security definer set search_path=pg_catalog,public as $$
 select o.name from storage.objects o left join auth.users u on u.id::text=o.owner_id where o.bucket_id='ticket-previews' and (o.created_at<now()-interval '30 days' or u.id is null) order by o.created_at limit 100;
$$;
revoke all on function public.ticket_preview_cleanup_candidates() from public,anon,authenticated;
grant execute on function public.ticket_preview_cleanup_candidates() to service_role;
notify pgrst,'reload schema';
commit;
