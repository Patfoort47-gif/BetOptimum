-- BET-82 à BET-85 : nouveaux objets de personnalisation. Après V17, réexécutable.
begin;
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
    and coalesce(jsonb_typeof(cfg->'celebration') = 'string' and cfg->>'celebration' in ('celeb-jump','celeb-fist','celeb-slide','celeb-flip','celeb-heart','celeb-archer','celeb-dance'), false)
    and coalesce(jsonb_typeof(cfg->'background') = 'string' and (cfg->>'background' ~ '^solid-[0-5]$' or cfg->>'background' in ('bg-training','bg-lockers','bg-tunnel','bg-rooftop','bg-sunset')
      or cfg->>'background' ~ '^bg-(rio|barcelona|madrid|paris|munich|london|aurora|coastal)-(in|out)$'), false)) then return false; end if;
  kit := cfg->'kit';
  if jsonb_typeof(kit) <> 'object' or exists (select 1 from jsonb_object_keys(kit) k where k not in ('item','number','name')) then return false; end if;
  if not (coalesce(jsonb_typeof(kit->'item') = 'string' and kit->>'item' in ('start-lime','start-blue','start-purple','start-orange','kit-plain-lime','kit-plain-blue','kit-plain-red','kit-plain-white','kit-plain-black','kit-plain-orange','kit-stripe-vertical','kit-stripe-band','kit-stripe-hoops','kit-stripe-scarf','kit-retro-70','kit-retro-90','kit-retro-champion','kit-champion','kit-gold','kit-chevron','kit-diagonal','kit-mosaic'), false)
    and (kit->'number' is null or jsonb_typeof(kit->'number') = 'null' or public.avatar_int(kit->'number', 0, 99))
    and coalesce(jsonb_typeof(kit->'name') = 'string' and kit->>'name' ~ '^[A-Z0-9 .-]{0,12}$', false)) then return false; end if;
  if jsonb_typeof(cfg->'accessories') <> 'array' or jsonb_array_length(cfg->'accessories') > 5 then return false; end if;
  if exists (select 1 from jsonb_array_elements(cfg->'accessories') e where jsonb_typeof(e) <> 'string' or public.avatar_slot(e #>> '{}') is null) then return false; end if;
  if (select count(*) from jsonb_array_elements_text(cfg->'accessories')) <> (select count(distinct public.avatar_slot(e)) from jsonb_array_elements_text(cfg->'accessories') e) then return false; end if;
  if jsonb_typeof(cfg->'showcase') <> 'array' or jsonb_array_length(cfg->'showcase') > 3 then return false; end if;
  if exists (select 1 from jsonb_array_elements(cfg->'showcase') e where jsonb_typeof(e) <> 'string' or (e #>> '{}') not in ('trophy-cup','trophy-pichichi','trophy-boot','trophy-glove','trophy-ball','trophy-crystal','trophy-laurel')) then return false; end if;
  if (select count(*) from jsonb_array_elements_text(cfg->'showcase')) <> (select count(distinct e) from jsonb_array_elements_text(cfg->'showcase') e) then return false; end if;
  return true;
end $$;
-- Catalogue initial : prix et règles identiques à shop.js. Les inventaires ne sont pas modifiés.
insert into public.shop_items(id,category,name,rarity,price,exclusive,min_division,collection,asset,pack_of)
select id,category,name,rarity,price,exclusive,min_division,collection,asset,pack_of from jsonb_to_recordset($catalog$[{"id":"kit-chevron","category":"kit","name":"Maillot Élan","rarity":"rare","price":1900,"exclusive":false,"min_division":null,"collection":"atelier","asset":null,"pack_of":null},{"id":"kit-diagonal","category":"kit","name":"Maillot Diagonale","rarity":"rare","price":2100,"exclusive":false,"min_division":null,"collection":"atelier","asset":null,"pack_of":null},{"id":"kit-mosaic","category":"kit","name":"Maillot Mosaïque","rarity":"rare","price":2400,"exclusive":false,"min_division":null,"collection":"atelier","asset":null,"pack_of":null},{"id":"trophy-crystal","category":"trophy","name":"Étoile de cristal","rarity":"epic","price":6500,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":null},{"id":"trophy-laurel","category":"trophy","name":"Lauriers du fair-play","rarity":"rare","price":2800,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":null},{"id":"bg-aurora-in","category":"background","name":"Stade de l’Aurore, vu de l'intérieur","rarity":"rare","price":2800,"exclusive":false,"min_division":null,"collection":"stade-aurora","asset":null,"pack_of":null},{"id":"bg-aurora-out","category":"background","name":"Stade de l’Aurore, vu de l'extérieur","rarity":"rare","price":2800,"exclusive":false,"min_division":null,"collection":"stade-aurora","asset":null,"pack_of":null},{"id":"bg-coastal-in","category":"background","name":"Stade de la Côte, vu de l'intérieur","rarity":"rare","price":2900,"exclusive":false,"min_division":null,"collection":"stade-coastal","asset":null,"pack_of":null},{"id":"bg-coastal-out","category":"background","name":"Stade de la Côte, vu de l'extérieur","rarity":"rare","price":2900,"exclusive":false,"min_division":null,"collection":"stade-coastal","asset":null,"pack_of":null},{"id":"bg-rooftop","category":"background","name":"Terrain sur les toits","rarity":"rare","price":1800,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":null},{"id":"bg-sunset","category":"background","name":"Entraînement au couchant","rarity":"common","price":800,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":null},{"id":"celeb-heart","category":"celebration","name":"Cœur aux supporters","rarity":"common","price":800,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":null},{"id":"celeb-archer","category":"celebration","name":"L’Archer","rarity":"rare","price":1900,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":null},{"id":"celeb-dance","category":"celebration","name":"Pas de victoire","rarity":"rare","price":2300,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":null},{"id":"pack-aurora","category":"pack","name":"Pack stade de l’Aurore","rarity":"rare","price":5200,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":["bg-aurora-in","bg-aurora-out","kit-plain-lime","acc-scarf"]},{"id":"pack-coastal","category":"pack","name":"Pack stade de la Côte","rarity":"rare","price":5360,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":["bg-coastal-in","bg-coastal-out","kit-plain-lime","acc-scarf"]}]$catalog$::jsonb) as r(id text,category text,name text,rarity text,price integer,exclusive boolean,min_division integer,collection text,asset text,pack_of jsonb)
on conflict(id) do update set name=excluded.name,price=excluded.price,rarity=excluded.rarity,pack_of=excluded.pack_of;
notify pgrst, 'reload schema';
commit;
