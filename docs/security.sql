/* =====================================================================
   🛡 WORK 메타버스 사옥 — 지갑 보안 (2단계, 2026-11-26)
   Supabase → SQL Editor → New query 에 이 파일 전체를 붙여 넣고 [Run] 한 번.
   여러 번 실행해도 괜찮아요.

   하는 일
   1) 지갑(wallets)을 사이트에서 직접 고치지 못하게 막음 (읽기만 허용)
   2) 돈이 바뀌는 일은 아래 서버 함수로만: 서버가 금액 · 하루 상한 · 잔액을 확인
   3) 주가는 서버가 매시간 새로 정함 (씨앗을 공개하지 않음 → 미래 가격을 미리 알 수 없음)
   4) 지갑 주인 확인: 기기마다 비밀 키. 다른 기기에서 쓰려면 '기기 연결 코드' 입력
   5) 결투 레벨 · 패배자 칭호도 주인만, 한 번에 한 판만큼만 바꿈 (duel_stats 직접 쓰기 금지)
   ===================================================================== */

/* ---------- 표 ---------- */
/* 지갑 표가 아직 없으면 만듦 */
create table if not exists public.wallets (
  name text primary key check (char_length(name) <= 16),
  cash double precision not null default 0,
  unpaid double precision not null default 0,
  day text,
  day_secs int not null default 0 check (day_secs between 0 and 86400),
  paid_month text,
  savings double precision not null default 0,
  sav_day text,
  stocks jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.wallets add column if not exists day_pay double precision not null default 0;
alter table public.wallets add column if not exists last_tick timestamptz;
alter table public.wallets add column if not exists imported boolean not null default false;

create table if not exists public.wallet_keys (name text not null, key_hash text not null, created_at timestamptz not null default now(), primary key (name, key_hash)); /* 한 이름에 기기 키 여러 개 */
create table if not exists public.wallet_ledger (id bigserial primary key, name text not null, kind text not null, amount double precision not null, day text not null, ref text, created_at timestamptz not null default now());
create index if not exists wallet_ledger_day on public.wallet_ledger (name, kind, day);
create table if not exists public.shop_prices (id text primary key, price int not null);
create table if not exists public.stock_prices (code text not null, h int not null, price double precision not null, primary key (code, h));
create table if not exists public.duel_bets (duel_id text not null, name text not null, amount double precision not null, result text, settled boolean not null default false, created_at timestamptz not null default now(), primary key (duel_id, name));
alter table public.duel_bets add column if not exists opp text; /* 판돈을 건 사람이 고른 상대 이름 */

/* 지갑: 읽기만 (쓰기는 아래 함수로만) */
alter table public.wallets enable row level security;
drop policy if exists "wallets insert" on public.wallets;
drop policy if exists "wallets update" on public.wallets;
revoke insert, update, delete on public.wallets from anon, authenticated;
/* 비밀 표: 사이트에서 아예 못 봄 */
alter table public.wallet_keys enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.shop_prices enable row level security;
alter table public.stock_prices enable row level security;
alter table public.duel_bets enable row level security;
revoke all on public.wallet_keys, public.wallet_ledger, public.shop_prices, public.stock_prices, public.duel_bets from anon, authenticated;

/* 부티크 가격 (출석 한정판은 팔지 않으므로 없음) */
insert into public.shop_prices (id, price) values
  ('glasses', 30000),
  ('sunglasses', 50000),
  ('ribbon', 40000),
  ('santa', 50000),
  ('catears', 60000),
  ('flower', 80000),
  ('halo', 150000),
  ('butterfly', 150000),
  ('bat', 180000),
  ('wings', 250000),
  ('crown', 300000),
  ('diacrown', 1000000),
  ('tote', 120000),
  ('backpack', 180000),
  ('clutch', 220000),
  ('chainbag', 350000),
  ('pradybag', 420000),
  ('kickblack', 150000),
  ('kickmint', 220000),
  ('kickgold', 400000),
  ('muffler', 70000),
  ('tweed', 280000),
  ('cape', 300000),
  ('dress', 380000),
  ('furcoat', 450000),
  ('gucicardi', 390000),
  ('blackdress', 360000),
  ('reddress', 520000),
  ('navysuit', 480000),
  ('tuxedo', 550000)
on conflict (id) do update set price = excluded.price;

/* 지금까지의 주가 48시간 (사이트에 보이던 가격 그대로 이어 감) */
insert into public.stock_prices (code, h, price) values
('WRK', 559, 52482.90),
('WRK', 560, 52736.17),
('WRK', 561, 52614.76),
('WRK', 562, 52595.56),
('WRK', 563, 52939.11),
('WRK', 564, 52594.54),
('WRK', 565, 53022.73),
('WRK', 566, 53322.12),
('WRK', 567, 53061.39),
('WRK', 568, 53283.00),
('WRK', 569, 53059.72),
('WRK', 570, 52939.54),
('WRK', 571, 52554.85),
('WRK', 572, 52630.95),
('WRK', 573, 52046.73),
('WRK', 574, 51465.91),
('WRK', 575, 51384.63),
('WRK', 576, 50962.13),
('WRK', 577, 50584.76),
('WRK', 578, 50288.24),
('WRK', 579, 50158.66),
('WRK', 580, 50733.98),
('WRK', 581, 50340.98),
('WRK', 582, 50348.91),
('WRK', 583, 50525.42),
('WRK', 584, 50386.19),
('WRK', 585, 50169.14),
('WRK', 586, 50082.37),
('WRK', 587, 50045.28),
('WRK', 588, 50307.22),
('WRK', 589, 50776.22),
('WRK', 590, 50744.20),
('WRK', 591, 50181.12),
('WRK', 592, 50349.20),
('WRK', 593, 49848.58),
('WRK', 594, 50035.48),
('WRK', 595, 50156.42),
('WRK', 596, 50394.81),
('WRK', 597, 50302.48),
('WRK', 598, 50826.42),
('WRK', 599, 51183.04),
('WRK', 600, 50954.86),
('WRK', 601, 50854.38),
('WRK', 602, 51796.63),
('WRK', 603, 53331.18),
('WRK', 604, 53735.51),
('WRK', 605, 52480.22),
('WRK', 606, 53672.57),
('HGB', 559, 22750.10),
('HGB', 560, 23270.61),
('HGB', 561, 23631.41),
('HGB', 562, 24059.41),
('HGB', 563, 24346.67),
('HGB', 564, 24102.61),
('HGB', 565, 24600.15),
('HGB', 566, 24429.88),
('HGB', 567, 24082.08),
('HGB', 568, 23628.09),
('HGB', 569, 23798.22),
('HGB', 570, 23873.27),
('HGB', 571, 23725.34),
('HGB', 572, 23139.39),
('HGB', 573, 23239.14),
('HGB', 574, 23170.04),
('HGB', 575, 22805.66),
('HGB', 576, 22788.50),
('HGB', 577, 22915.38),
('HGB', 578, 23374.98),
('HGB', 579, 22941.24),
('HGB', 580, 23330.17),
('HGB', 581, 23777.45),
('HGB', 582, 23283.74),
('HGB', 583, 23291.27),
('HGB', 584, 22963.97),
('HGB', 585, 23187.29),
('HGB', 586, 23551.47),
('HGB', 587, 23352.78),
('HGB', 588, 23167.44),
('HGB', 589, 23468.60),
('HGB', 590, 23043.89),
('HGB', 591, 23523.61),
('HGB', 592, 23627.84),
('HGB', 593, 23896.29),
('HGB', 594, 24275.37),
('HGB', 595, 24628.82),
('HGB', 596, 24318.63),
('HGB', 597, 24405.24),
('HGB', 598, 23927.49),
('HGB', 599, 24472.89),
('HGB', 600, 23865.39),
('HGB', 601, 23336.41),
('HGB', 602, 23966.40),
('HGB', 603, 23654.46),
('HGB', 604, 22270.65),
('HGB', 605, 23394.40),
('HGB', 606, 24747.71),
('GRM', 559, 31406.69),
('GRM', 560, 31743.62),
('GRM', 561, 31807.22),
('GRM', 562, 31295.02),
('GRM', 563, 31797.80),
('GRM', 564, 31916.91),
('GRM', 565, 31566.59),
('GRM', 566, 32090.14),
('GRM', 567, 32005.27),
('GRM', 568, 31934.82),
('GRM', 569, 31789.02),
('GRM', 570, 31506.35),
('GRM', 571, 31989.22),
('GRM', 572, 31505.88),
('GRM', 573, 31352.47),
('GRM', 574, 30961.32),
('GRM', 575, 30524.65),
('GRM', 576, 30353.40),
('GRM', 577, 30777.86),
('GRM', 578, 30249.10),
('GRM', 579, 30672.28),
('GRM', 580, 30849.93),
('GRM', 581, 30750.89),
('GRM', 582, 31000.46),
('GRM', 583, 31274.92),
('GRM', 584, 31360.98),
('GRM', 585, 30961.29),
('GRM', 586, 31008.38),
('GRM', 587, 30859.37),
('GRM', 588, 31348.56),
('GRM', 589, 31305.79),
('GRM', 590, 31428.69),
('GRM', 591, 31337.58),
('GRM', 592, 31546.39),
('GRM', 593, 31883.90),
('GRM', 594, 32439.11),
('GRM', 595, 32756.24),
('GRM', 596, 33340.05),
('GRM', 597, 33752.17),
('GRM', 598, 34088.39),
('GRM', 599, 33571.29),
('GRM', 600, 33857.90),
('GRM', 601, 33507.32),
('GRM', 602, 33751.40),
('GRM', 603, 33883.40),
('GRM', 604, 35100.33),
('GRM', 605, 36202.76),
('GRM', 606, 35607.50),
('BYF', 559, 9664.38),
('BYF', 560, 9690.19),
('BYF', 561, 9634.81),
('BYF', 562, 9606.70),
('BYF', 563, 9554.28),
('BYF', 564, 9521.18),
('BYF', 565, 9448.02),
('BYF', 566, 9512.12),
('BYF', 567, 9519.72),
('BYF', 568, 9446.56),
('BYF', 569, 9491.48),
('BYF', 570, 9531.48),
('BYF', 571, 9483.72),
('BYF', 572, 9508.14),
('BYF', 573, 9486.52),
('BYF', 574, 9456.15),
('BYF', 575, 9477.02),
('BYF', 576, 9513.18),
('BYF', 577, 9513.07),
('BYF', 578, 9505.31),
('BYF', 579, 9496.42),
('BYF', 580, 9448.93),
('BYF', 581, 9417.25),
('BYF', 582, 9366.94),
('BYF', 583, 9296.18),
('BYF', 584, 9331.25),
('BYF', 585, 9362.60),
('BYF', 586, 9330.70),
('BYF', 587, 9391.56),
('BYF', 588, 9346.91),
('BYF', 589, 9379.60),
('BYF', 590, 9425.03),
('BYF', 591, 9408.22),
('BYF', 592, 9434.56),
('BYF', 593, 9446.65),
('BYF', 594, 9390.41),
('BYF', 595, 9392.95),
('BYF', 596, 9460.26),
('BYF', 597, 9513.06),
('BYF', 598, 9577.54),
('BYF', 599, 9534.36),
('BYF', 600, 9492.70),
('BYF', 601, 9448.37),
('BYF', 602, 9460.72),
('BYF', 603, 9438.25),
('BYF', 604, 9583.80),
('BYF', 605, 9403.48),
('BYF', 606, 9432.81)
on conflict do nothing;

/* ---------- 공통 ---------- */
create or replace function public._kst_day() returns text language sql stable as $$ select to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD') $$;
create or replace function public._hour() returns int language sql stable as $$ select floor(extract(epoch from now()) / 3600 - extract(epoch from timestamptz '2026-11-01 00:00:00+00') / 3600)::int $$;

/* 지갑 주인 확인: 처음 쓰는 이름이면 이 기기가 주인 / 아니면 키가 맞아야 함 */
create or replace function public._auth(p_name text, p_key text) returns void language plpgsql security definer set search_path = public as $$
declare h text := md5(coalesce(p_key, '') || ':' || p_name);
begin
  if p_name is null or char_length(p_name) < 1 or char_length(p_name) > 16 or char_length(coalesce(p_key, '')) < 12 then raise exception 'bad_input'; end if;
  if exists (select 1 from wallet_keys where name = p_name and key_hash = h) then return; end if;
  if exists (select 1 from wallet_keys where name = p_name) then raise exception 'not_owner'; end if;
  insert into wallet_keys (name, key_hash) values (p_name, h) on conflict do nothing; /* 처음 쓰는 이름 → 이 기기가 주인 */
end $$;

/* 지갑 가져오기 (없으면 입사 축하금 10만 원) + 날짜 바뀜 · 적금 이자 정리 */
create or replace function public._wallet(p_name text) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; t text := _kst_day(); d int; r record;
begin
  /* 결과가 안 온 지 3분 넘은 결투 판돈은 정리(돌려받기) */
  for r in select duel_id from duel_bets where name = p_name and not settled and created_at < now() - interval '3 minutes' loop perform _duel_resolve(r.duel_id); end loop;
  select * into w from wallets where name = p_name for update;
  if not found then
    insert into wallets (name, cash, day, day_secs, savings, sav_day, stocks, day_pay) values (p_name, 100000, t, 0, 0, t, '{}'::jsonb, 0) returning * into w;
    insert into wallet_ledger (name, kind, amount, day) values (p_name, 'welcome', 100000, t);
  end if;
  if coalesce(w.day, '') <> t then w.day := t; w.day_secs := 0; w.day_pay := 0; end if;
  if coalesce(w.unpaid, 0) >= 1 then w.cash := w.cash + w.unpaid; w.unpaid := 0; end if;
  d := greatest(0, (t::date - coalesce(nullif(w.sav_day, ''), t)::date));
  if d > 0 then w.savings := w.savings * power(1.001, least(d, 400)); w.sav_day := t; end if;
  w.stocks := coalesce(w.stocks, '{}'::jsonb) - '__daypay';
  update wallets set cash = w.cash, unpaid = 0, day = w.day, day_secs = w.day_secs, day_pay = w.day_pay, savings = w.savings, sav_day = w.sav_day, stocks = w.stocks, updated_at = now() where name = p_name;
  return w;
end $$;

create or replace function public._save(w wallets) returns wallets language plpgsql security definer set search_path = public as $$
begin
  update wallets set cash = w.cash, day = w.day, day_secs = w.day_secs, day_pay = w.day_pay, savings = w.savings, sav_day = w.sav_day, stocks = w.stocks, last_tick = w.last_tick, updated_at = now() where name = w.name;
  return w;
end $$;

/* ---------- 사이트가 부르는 함수 ---------- */
create or replace function public.wallet_get(p_name text, p_key text) returns wallets language plpgsql security definer set search_path = public as $$
begin perform _auth(p_name, p_key); return _wallet(p_name); end $$;

/* 일급: 서버 시계로 지난 시간만큼 (한 번에 최대 90초, 5분 넘게 비었으면 0, 하루 12시간까지) */
create or replace function public.wallet_tick(p_name text, p_key text) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; secs double precision; add double precision;
begin
  perform _auth(p_name, p_key); w := _wallet(p_name);
  secs := coalesce(extract(epoch from now() - w.last_tick), 0);
  if w.last_tick is null or secs > 300 then secs := 0; end if;
  add := greatest(0, least(secs, 90, 43200 - w.day_secs));
  w.day_secs := w.day_secs + floor(add); w.day_pay := w.day_pay + add * 10320 / 3600.0; w.cash := w.cash + add * 10320 / 3600.0; w.last_tick := now();
  return _save(w);
end $$;

/* 눈싸움 · 레이스 상금 (한 번 · 하루 상한) */
create or replace function public.wallet_reward(p_name text, p_key text, p_kind text, p_amount double precision) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; per double precision; cap double precision; got double precision; give double precision; t text := _kst_day();
begin
  perform _auth(p_name, p_key); w := _wallet(p_name);
  if p_kind = 'snow' then per := 1000; cap := 50000;
  elsif p_kind = 'race' then per := 60000; cap := 100000;
  else raise exception 'bad_kind'; end if;
  select coalesce(sum(amount), 0) into got from wallet_ledger where name = p_name and kind = p_kind and day = t;
  give := greatest(0, least(coalesce(p_amount, 0), per, cap - got));
  if p_kind = 'snow' and exists (select 1 from wallet_ledger where name = p_name and kind = 'snow' and created_at > now() - interval '150 milliseconds') then give := 0; end if;
  if give > 0 then w.cash := w.cash + give; insert into wallet_ledger (name, kind, amount, day) values (p_name, p_kind, give, t); end if;
  return _save(w);
end $$;

/* 부티크: 가격은 서버 목록에서 */
create or replace function public.shop_buy(p_name text, p_key text, p_id text) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; pr int; its jsonb;
begin
  perform _auth(p_name, p_key); w := _wallet(p_name);
  select price into pr from shop_prices where id = p_id;
  if pr is null then raise exception 'not_for_sale'; end if;
  its := coalesce(w.stocks -> '__items', '[]'::jsonb);
  if its ? p_id then return w; end if;
  if w.cash < pr then raise exception 'no_cash'; end if;
  w.cash := w.cash - pr; w.stocks := jsonb_set(w.stocks, '{__items}', its || to_jsonb(p_id));
  insert into wallet_ledger (name, kind, amount, day, ref) values (p_name, 'shop', -pr, _kst_day(), p_id);
  return _save(w);
end $$;

/* 착용: 가진 것만 (빈 값 = 벗기) */
create or replace function public.wallet_wear(p_name text, p_key text, p_slot text, p_id text) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; wr jsonb;
begin
  perform _auth(p_name, p_key); w := _wallet(p_name);
  if char_length(p_slot) > 10 then raise exception 'bad_input'; end if;
  wr := coalesce(w.stocks -> '__wear', '{}'::jsonb);
  if p_id is null or p_id = '' then wr := wr - p_slot;
  elsif coalesce(w.stocks -> '__items', '[]'::jsonb) ? p_id then wr := jsonb_set(wr, array[p_slot], to_jsonb(p_id));
  else raise exception 'not_owned'; end if;
  w.stocks := jsonb_set(w.stocks, '{__wear}', wr);
  return _save(w);
end $$;

/* 🎄 크리스마스 출석: 오늘 도장(서버 날짜) + 조건 채운 선물 */
create or replace function public.advent_checkin(p_name text, p_key text) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; t text := _kst_day(); ds jsonb; its jsonb; n int; r record;
begin
  perform _auth(p_name, p_key); w := _wallet(p_name);
  if t < '2026-11-24' or t > '2026-12-25' then return w; end if;
  ds := coalesce(w.stocks -> '__xmas', '[]'::jsonb);
  if not ds ? t then ds := ds || to_jsonb(t); end if;
  select count(*) into n from jsonb_array_elements_text(ds) x where x >= '2026-11-24' and x <= '2026-12-25';
  its := coalesce(w.stocks -> '__items', '[]'::jsonb);
  for r in select * from (values ('rudolph', 1), ('xknit', 3), ('santasack', 6), ('santaboots', 10), ('santacoat', 15), ('snowwings', 21)) v(id, need) loop
    if n >= r.need and not its ? r.id then its := its || to_jsonb(r.id); end if;
  end loop;
  if ds ? '2026-12-25' and not its ? 'xstar' then its := its || to_jsonb('xstar'::text); end if;
  w.stocks := jsonb_set(jsonb_set(w.stocks, '{__xmas}', ds), '{__items}', its);
  return _save(w);
end $$;

/* 🏦 적금 넣기(+) · 빼기(-) */
create or replace function public.saving_move(p_name text, p_key text, p_amount double precision) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; a double precision;
begin
  perform _auth(p_name, p_key); w := _wallet(p_name);
  if p_amount > 0 then a := least(floor(p_amount), floor(w.cash)); w.cash := w.cash - a; w.savings := w.savings + a;
  elsif p_amount < 0 then a := least(floor(-p_amount), floor(w.savings)); w.savings := w.savings - a; w.cash := w.cash + a; end if;
  return _save(w);
end $$;

/* 📈 주가: 매시간 서버가 새로 정함 (random, 씨앗 공개 안 함). 아직 안 정한 시간은 부를 때 채움 */
create or replace function public._ensure_prices() returns void language plpgsql security definer set search_path = public as $$
declare st record; last_h int; p double precision; v double precision; hh int; cur int := _hour();
begin
  for st in select * from (values ('WRK', 52000.0, 0.03), ('HGB', 18000.0, 0.06), ('GRM', 34000.0, 0.045), ('BYF', 9800.0, 0.02)) s(code, base, vol) loop
    select h, price into last_h, p from stock_prices where code = st.code order by h desc limit 1;
    if last_h is null then last_h := cur - 1; p := st.base; end if;
    hh := greatest(last_h + 1, cur - 400);
    while hh <= cur loop
      p := greatest(st.base * 0.2, p * (1 + (random() * 2 - 1) * st.vol + 0.12 * st.vol * ln(st.base / p) + 0.0001));
      insert into stock_prices (code, h, price) values (st.code, hh, p) on conflict do nothing;
      select price into p from stock_prices where code = st.code and h = hh;
      hh := hh + 1;
    end loop;
  end loop;
end $$;

/* 사이트용: 지금까지 48시간 가격 (미래는 없음) */
create or replace function public.stock_prices_now() returns jsonb language plpgsql security definer set search_path = public as $$
declare cur int := _hour();
begin
  perform _ensure_prices();
  return jsonb_build_object('h', cur, 'prices', (select jsonb_object_agg(code, arr) from (select code, jsonb_agg(price order by h) arr from stock_prices where h > cur - 48 and h <= cur group by code) x));
end $$;

/* 사고(+) 팔기(-): 지금 서버 가격으로 */
create or replace function public.stock_trade(p_name text, p_key text, p_code text, p_qty int) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; pr double precision; hold jsonb; q int; c double precision; n int;
begin
  perform _auth(p_name, p_key); w := _wallet(p_name); perform _ensure_prices();
  select round(price / 10) * 10 into pr from stock_prices where code = p_code and h = _hour();
  if pr is null then raise exception 'bad_code'; end if;
  hold := coalesce(w.stocks -> p_code, '{"q":0,"c":0}'::jsonb); q := coalesce((hold ->> 'q')::int, 0); c := coalesce((hold ->> 'c')::double precision, 0);
  if p_qty > 0 then
    n := least(p_qty, floor(w.cash / pr)::int); if n < 1 then raise exception 'no_cash'; end if;
    w.cash := w.cash - n * pr; c := (c * q + pr * n) / (q + n); q := q + n;
  elsif p_qty < 0 then
    n := least(-p_qty, q); if n < 1 then return w; end if;
    w.cash := w.cash + n * pr; q := q - n; if q = 0 then c := 0; end if;
  else return w; end if;
  if q = 0 then w.stocks := w.stocks - p_code; else w.stocks := jsonb_set(w.stocks, array[p_code], jsonb_build_object('q', q, 'c', c)); end if;
  return _save(w);
end $$;

/* ⚔️ 결투 판돈: 걸면 서버가 보관 → 서로 고른 상대이고 두 사람의 결과가 맞을 때만 이긴 쪽에 2배 (안 맞으면 각자 돌려받음) */
drop function if exists public.duel_stake(text, text, text, double precision);
create or replace function public.duel_stake(p_name text, p_key text, p_duel text, p_amount double precision, p_opp text default null) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; a double precision;
begin
  perform _auth(p_name, p_key);
  if p_duel is null or char_length(p_duel) < 1 or char_length(p_duel) > 64 or char_length(coalesce(p_opp, '')) > 16 then raise exception 'bad_input'; end if;
  perform pg_advisory_xact_lock(hashtext('duel:' || p_duel)); /* 같은 결투는 한 번에 하나씩 */
  w := _wallet(p_name);
  if exists (select 1 from duel_bets where duel_id = p_duel and name = p_name) then return w; end if;
  if (select count(*) from duel_bets where duel_id = p_duel) >= 2 then raise exception 'duel_full'; end if; /* 한 결투에 두 사람만 */
  a := least(floor(coalesce(p_amount, 0)), floor(w.cash)); if a < 1 then raise exception 'no_cash'; end if;
  w.cash := w.cash - a; insert into duel_bets (duel_id, name, amount, opp) values (p_duel, p_name, a, nullif(p_opp, ''));
  return _save(w);
end $$;

create or replace function public._duel_resolve(p_duel text) returns void language plpgsql security definer set search_path = public as $$
declare a record; b record; pot double precision;
begin
  perform pg_advisory_xact_lock(hashtext('duel:' || p_duel)); /* 동시에 여러 번 불러도 한 번만 정산 */
  select * into a from duel_bets where duel_id = p_duel and not settled order by name limit 1;
  select * into b from duel_bets where duel_id = p_duel and not settled and name <> coalesce(a.name, '') order by name limit 1;
  if a.name is null then return; end if;
  if b.name is null then /* 상대 판돈이 없거나 오래 결과가 안 오면 돌려줌 */
    if a.created_at < now() - interval '3 minutes' then update wallets set cash = cash + a.amount where name = a.name; update duel_bets set settled = true where duel_id = p_duel and name = a.name; end if;
    return;
  end if;
  if a.result is null or b.result is null then
    if least(a.created_at, b.created_at) > now() - interval '3 minutes' then return; end if;
    a.result := 'x'; b.result := 'y'; /* 시간 초과 → 돌려줌 */
  end if;
  if (a.opp is not null and a.opp <> b.name) or (b.opp is not null and b.opp <> a.name) then a.result := 'x'; b.result := 'y'; end if; /* 서로 고른 상대가 아니면 돌려줌 */
  pot := least(a.amount, b.amount);
  if a.result = 'win' and b.result = 'lose' then update wallets set cash = cash + pot * 2 + (a.amount - pot) where name = a.name; update wallets set cash = cash + (b.amount - pot) where name = b.name;
  elsif b.result = 'win' and a.result = 'lose' then update wallets set cash = cash + pot * 2 + (b.amount - pot) where name = b.name; update wallets set cash = cash + (a.amount - pot) where name = a.name;
  else update wallets set cash = cash + a.amount where name = a.name; update wallets set cash = cash + b.amount where name = b.name; end if;
  update duel_bets set settled = true where duel_id = p_duel and name in (a.name, b.name);
end $$;

create or replace function public.duel_report(p_name text, p_key text, p_duel text, p_result text) returns wallets language plpgsql security definer set search_path = public as $$
begin
  perform _auth(p_name, p_key);
  if p_result not in ('win', 'lose', 'draw') then raise exception 'bad_input'; end if;
  update duel_bets set result = p_result where duel_id = p_duel and name = p_name and result is null;
  perform _duel_resolve(p_duel);
  return _wallet(p_name);
end $$;

/* 기기 연결 코드: 주인 기기가 코드를 만들면 → 다른 기기가 그 코드를 자기 키로 씀 (기기 키가 하나 늘어남) */
create or replace function public.wallet_link_code(p_name text, p_key text) returns text language plpgsql security definer set search_path = public as $$
declare code text := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));
begin
  perform _auth(p_name, p_key);
  insert into wallet_keys (name, key_hash) values (p_name, md5(code || ':' || p_name)) on conflict do nothing;
  return code;
end $$;

/* 📦 예전 지갑(각자 브라우저에 있던 것) 한 번만 가져오기: 산 아이템 값 + 현금 + 예금 + 주식 값 합쳐 최대 300만 원(아이템 먼저), 아이템은 실제 상품 + 출석 조건 맞는 선물만, 2026-11-27 0시 전에 처음 들어온 이름만 */
create or replace function public.wallet_import(p_name text, p_key text, p_cash double precision, p_savings double precision, p_items jsonb, p_wear jsonb, p_xmas jsonb) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; tot double precision; sav double precision; bud double precision; pr double precision; its jsonb; ds jsonb; wr jsonb := '{}'::jsonb; n int; r record; k text; v text; t text := _kst_day();
begin
  perform _auth(p_name, p_key); w := _wallet(p_name);
  if w.imported then return w; end if;
  /* 서버 지갑이 이 시각 뒤에 처음 생긴 이름은 옮길 예전 지갑이 없음 → 옮기기 닫음 (새 이름을 만들어 300만 원씩 받는 것 막기) */
  if (select min(created_at) from wallet_ledger where name = p_name and kind = 'welcome') >= timestamptz '2026-11-27 00:00:00+09' then
    update wallets set imported = true where name = p_name; w.imported := true; return w;
  end if;
  its := coalesce(w.stocks -> '__items', '[]'::jsonb); bud := 3000000;
  for v in select x from jsonb_array_elements_text(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) x loop
    select price into pr from shop_prices where id = v;
    if pr is not null and pr <= bud and not its ? v then its := its || to_jsonb(v); bud := bud - pr; end if;
  end loop;
  sav := least(greatest(coalesce(p_savings, 0), 0), bud);
  tot := least(greatest(coalesce(p_cash, 0), 0) + sav, bud);
  sav := least(sav, tot);
  w.cash := greatest(w.cash - 100000, 0) + (tot - sav); w.savings := w.savings + sav;
  ds := coalesce(w.stocks -> '__xmas', '[]'::jsonb);
  for v in select x from jsonb_array_elements_text(case when jsonb_typeof(p_xmas) = 'array' then p_xmas else '[]'::jsonb end) x loop
    if v ~ '^\d{4}-\d{2}-\d{2}$' and v >= '2026-11-24' and v <= t and not ds ? v then ds := ds || to_jsonb(v); end if;
  end loop;
  select count(*) into n from jsonb_array_elements_text(ds) x where x >= '2026-11-24' and x <= '2026-12-25';
  for r in select * from (values ('rudolph', 1), ('xknit', 3), ('santasack', 6), ('santaboots', 10), ('santacoat', 15), ('snowwings', 21)) vv(id, need) loop
    if n >= r.need and not its ? r.id then its := its || to_jsonb(r.id); end if;
  end loop;
  if jsonb_typeof(p_wear) = 'object' then
    for k, v in select key, value from jsonb_each_text(p_wear) loop if its ? v then wr := wr || jsonb_build_object(k, v); end if; end loop;
  end if;
  w.stocks := jsonb_set(jsonb_set(jsonb_set(w.stocks, '{__items}', its), '{__xmas}', ds), '{__wear}', coalesce(w.stocks -> '__wear', '{}'::jsonb) || wr);
  w := _save(w);
  update wallets set imported = true where name = p_name;
  insert into wallet_ledger (name, kind, amount, day) values (p_name, 'import', tot, t);
  w.imported := true;
  return w;
end $$;

/* ---------- ⚔️ 결투 레벨 · 패배자 칭호 ---------- */
create table if not exists public.duel_stats (
  name text primary key check (char_length(name) <= 16),
  level int not null default 1 check (level between 1 and 100000),
  loser boolean not null default false,
  win int not null default 0,
  lose int not null default 0,
  day text,
  challenges int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.duel_stats add column if not exists loser_day text;
alter table public.duel_stats add column if not exists last_win timestamptz;
alter table public.duel_stats enable row level security;
drop policy if exists "duel read" on public.duel_stats;
create policy "duel read" on public.duel_stats for select using (true);
drop policy if exists "duel insert" on public.duel_stats;
drop policy if exists "duel update" on public.duel_stats;
revoke insert, update, delete on public.duel_stats from anon, authenticated;
grant select on public.duel_stats to anon, authenticated;

/* 지갑 주인(기기 키)만 자기 기록을 바꿈. 한 번에 이긴 판 +1(레벨 +1) 또는 진 판 +1만, 이긴 판은 30초에 한 번까지.
   패배자 칭호는 진 날(한국 날짜)이 지나거나 다시 이겨야 떨어짐 */
create or replace function public.duel_stats_save(p_name text, p_key text, p_level int, p_loser boolean, p_win int, p_lose int, p_day text, p_challenges int) returns duel_stats language plpgsql security definer set search_path = public as $$
declare s duel_stats; dw int; dl int; t text := _kst_day();
begin
  perform _auth(p_name, p_key);
  insert into duel_stats (name) values (p_name) on conflict do nothing;
  select * into s from duel_stats where name = p_name for update;
  dw := coalesce(p_win, s.win) - s.win; dl := coalesce(p_lose, s.lose) - s.lose;
  if dw not in (0, 1) or dl not in (0, 1) or dw + dl > 1 or coalesce(p_level, s.level) - s.level <> dw then raise exception 'bad_stats'; end if;
  if dw = 1 then
    if s.last_win > now() - interval '30 seconds' then raise exception 'too_fast'; end if;
    s.win := s.win + 1; s.level := s.level + 1; s.loser := false; s.loser_day := null; s.last_win := now();
  elsif dl = 1 then
    s.lose := s.lose + 1; s.loser := true; s.loser_day := t;
  elsif s.loser and p_loser is false and coalesce(s.loser_day, '') <> t then
    s.loser := false; s.loser_day := null;
  end if;
  s.day := left(p_day, 20); s.challenges := least(greatest(coalesce(p_challenges, 0), 0), 100);
  update duel_stats set level = s.level, loser = s.loser, win = s.win, lose = s.lose, day = s.day, challenges = s.challenges, loser_day = s.loser_day, last_win = s.last_win, updated_at = now() where name = p_name returning * into s;
  return s;
end $$;

grant execute on function public.wallet_get(text, text), public.wallet_tick(text, text), public.wallet_reward(text, text, text, double precision),
  public.shop_buy(text, text, text), public.wallet_wear(text, text, text, text), public.advent_checkin(text, text), public.saving_move(text, text, double precision),
  public.stock_prices_now(), public.stock_trade(text, text, text, int), public.duel_stake(text, text, text, double precision, text), public.duel_report(text, text, text, text),
  public.duel_stats_save(text, text, int, boolean, int, int, text, int),
  public.wallet_link_code(text, text),
  public.wallet_import(text, text, double precision, double precision, jsonb, jsonb, jsonb) to anon, authenticated;
revoke execute on function public._auth(text, text), public._wallet(text), public._save(wallets), public._ensure_prices(), public._duel_resolve(text) from anon, authenticated, public;
notify pgrst, 'reload schema';
