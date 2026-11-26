/* 🛋 WORK HOME 가구점 (11-26). security.sql · estate.sql을 실행한 Supabase에서 SQL Editor에 붙여 넣고 Run. 여러 번 실행해도 안전 */
create table if not exists public.furn_prices (id text primary key, price int not null);
alter table public.furn_prices enable row level security;
revoke all on public.furn_prices from anon, authenticated;
insert into public.furn_prices (id, price) values
  ('rug', 30000), ('plant', 40000), ('nightstand', 40000), ('lamp', 50000), ('coffee', 60000), ('armchair', 80000), ('shelf', 90000), ('desk', 120000),
  ('sofa', 150000), ('wardrobe', 180000), ('bed', 220000), ('dining', 220000), ('tv', 250000), ('aquarium', 280000), ('fireplace', 300000), ('piano', 450000)
on conflict (id) do update set price = excluded.price;

/* 가구 사기: 집이 있어야 함(배달지) · 가격은 서버 표 · 같은 가구 여러 개 가능 → stocks.__furn = {id: 개수} */
create or replace function public.furn_buy(p_name text, p_key text, p_id text) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; pr int; fu jsonb;
begin
  perform _auth(p_name, p_key); w := _wallet(p_name);
  select price into pr from furn_prices where id = p_id;
  if pr is null then raise exception 'bad_item'; end if;
  if not exists (select 1 from estates where name = p_name) then raise exception 'no_home'; end if;
  if w.cash < pr then raise exception 'no_cash'; end if;
  fu := coalesce(w.stocks -> '__furn', '{}'::jsonb);
  w.cash := w.cash - pr;
  w.stocks := jsonb_set(w.stocks, '{__furn}', fu || jsonb_build_object(p_id, coalesce((fu ->> p_id)::int, 0) + 1));
  insert into wallet_ledger (name, kind, amount, day, ref) values (p_name, 'furn', -pr, _kst_day(), p_id);
  return _save(w);
end $$;

/* 집 안 가구 배치 저장: [[id, x, z, 돌림 0~3], ...] 최대 40개 · 가진 개수까지만 · 방 안쪽 좌표만 */
create or replace function public.home_save(p_name text, p_key text, p_layout jsonb) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; fu jsonb; e jsonb; outl jsonb := '[]'::jsonb; cnt jsonb := '{}'::jsonb; id text; n int;
begin
  perform _auth(p_name, p_key); w := _wallet(p_name);
  if jsonb_typeof(p_layout) <> 'array' or jsonb_array_length(p_layout) > 40 then raise exception 'bad_layout'; end if;
  fu := coalesce(w.stocks -> '__furn', '{}'::jsonb);
  for e in select value from jsonb_array_elements(p_layout) loop
    if jsonb_typeof(e) <> 'array' then continue; end if;
    id := e ->> 0;
    if id is null or not exists (select 1 from furn_prices where furn_prices.id = e ->> 0) then continue; end if;
    n := coalesce((cnt ->> id)::int, 0) + 1;
    if n > coalesce((fu ->> id)::int, 0) then continue; end if; /* 가진 것보다 많이 놓지 못함 */
    cnt := cnt || jsonb_build_object(id, n);
    outl := outl || jsonb_build_array(jsonb_build_array(id, greatest(-8, least(8, round(coalesce((e ->> 1)::numeric, 0), 2))), greatest(-8, least(8, round(coalesce((e ->> 2)::numeric, 0), 2))), greatest(0, least(3, coalesce((e ->> 3)::int, 0)))));
  end loop;
  w.stocks := jsonb_set(w.stocks, '{__home}', outl);
  return _save(w);
end $$;

grant execute on function public.furn_buy(text, text, text), public.home_save(text, text, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
