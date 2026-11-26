/* 🏘 WORK 빌리지 부동산 분양 (11-26). security.sql을 실행한 Supabase에서 SQL Editor에 붙여 넣고 Run. 여러 번 실행해도 안전 */
create table if not exists public.estates (unit text primary key, name text not null unique, size int not null, price double precision not null, created_at timestamptz not null default now());
alter table public.estates enable row level security;
drop policy if exists "estates read" on public.estates;
create policy "estates read" on public.estates for select using (true);
revoke insert, update, delete on public.estates from anon, authenticated;
grant select on public.estates to anon, authenticated;
create table if not exists public.estate_prices (unit text not null, size int not null, price int not null, primary key (unit, size));
alter table public.estate_prices enable row level security;
revoke all on public.estate_prices from anon, authenticated;
insert into public.estate_prices (unit, size, price) values
  ('A1', 34, 1300000), ('A2', 34, 1500000), ('A3', 34, 1500000), ('A4', 34, 1600000), ('A5', 45, 2200000),
  ('H1', 30, 2000000), ('H1', 50, 3500000), ('H2', 30, 2000000), ('H2', 50, 3500000), ('H3', 30, 2000000), ('H3', 50, 3500000),
  ('H4', 30, 2000000), ('H4', 50, 3500000), ('H5', 30, 2000000), ('H5', 50, 3500000), ('H6', 30, 2000000), ('H6', 50, 3500000),
  ('H7', 30, 2000000), ('H7', 50, 3500000), ('H8', 30, 2000000), ('H8', 50, 3500000), ('H9', 30, 2000000), ('H9', 50, 3500000),
  ('H10', 30, 2000000), ('H10', 50, 3500000), ('H11', 30, 2000000), ('H11', 50, 3500000), ('H12', 30, 2000000), ('H12', 50, 3500000),
  ('H13', 30, 2000000), ('H13', 50, 3500000), ('H14', 30, 2000000), ('H14', 50, 3500000), ('H15', 30, 2000000), ('H15', 50, 3500000)
on conflict (unit, size) do update set price = excluded.price;

/* 누가 어느 집을 가졌는지 (누구나 볼 수 있음) */
create or replace function public.estate_list() returns setof estates language sql security definer set search_path = public as $$ select * from estates order by unit $$;

/* 분양 계약: 가격은 서버 표, 한 집에 한 사람 · 한 사람에 한 집, 동시에 계약해도 한 명만 */
create or replace function public.estate_buy(p_name text, p_key text, p_unit text, p_size int) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; pr int;
begin
  perform _auth(p_name, p_key);
  perform pg_advisory_xact_lock(hashtext('estate'));
  w := _wallet(p_name);
  select price into pr from estate_prices where unit = p_unit and size = p_size;
  if pr is null then raise exception 'bad_unit'; end if;
  if exists (select 1 from estates where name = p_name) then raise exception 'has_home'; end if;
  if exists (select 1 from estates where unit = p_unit) then raise exception 'sold'; end if;
  if w.cash < pr then raise exception 'no_cash'; end if;
  w.cash := w.cash - pr;
  insert into estates (unit, name, size, price) values (p_unit, p_name, p_size, pr);
  insert into wallet_ledger (name, kind, amount, day, ref) values (p_name, 'estate', -pr, _kst_day(), p_unit);
  return _save(w);
end $$;

/* 되팔기: 산 값의 90% 돌려받음 */
create or replace function public.estate_sell(p_name text, p_key text) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; e estates;
begin
  perform _auth(p_name, p_key);
  perform pg_advisory_xact_lock(hashtext('estate'));
  w := _wallet(p_name);
  select * into e from estates where name = p_name;
  if e.unit is null then raise exception 'no_home'; end if;
  delete from estates where unit = e.unit;
  w.cash := w.cash + floor(e.price * 0.9);
  insert into wallet_ledger (name, kind, amount, day, ref) values (p_name, 'estate_sell', floor(e.price * 0.9), _kst_day(), e.unit);
  return _save(w);
end $$;

grant execute on function public.estate_list(), public.estate_buy(text, text, text, int), public.estate_sell(text, text) to anon, authenticated;
notify pgrst, 'reload schema';
