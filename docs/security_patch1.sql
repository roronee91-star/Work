/* =====================================================================
   🛡 지갑 · 결투 보안 보완 (security.sql을 이미 실행한 Supabase용, 2026-11-26)
   Supabase → SQL Editor → New query 에 이 파일 전체를 붙여 넣고 [Run] 한 번.
   여러 번 실행해도 괜찮아요. (처음 만드는 곳은 security.sql에 같은 내용이 들어 있어요)

   하는 일
   1) 결투 판돈: 남의 결투에 끼어들어 판돈을 가로채지 못하게 (상대 이름이 서로 맞아야 정산, 한 결투에 두 사람만)
   2) 결투 판돈: 결과 보고를 동시에 여러 번 보내 두 번 받지 못하게 (정산할 때 결투별로 잠금)
   3) 예전 지갑 옮기기: 2026-11-27 0시(한국 시각) 뒤에 처음 만든 이름은 못 씀 (새 이름마다 300만 원 받기 막음)
   4) 결투 레벨 · 패배자 칭호: 지갑 주인만, 한 번에 한 판만큼만 바꿀 수 있게 (남의 칭호 붙이기 · 레벨 마음대로 올리기 막음)
   5) wallets · duel_stats 표를 사이트에서 직접 고치지 못하게 다시 한 번 막음 (supabase.sql을 다시 실행해도 안전하게)
   ===================================================================== */

/* ---------- 1) 2) 결투 판돈 ---------- */
alter table public.duel_bets add column if not exists opp text;

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

/* ---------- 3) 예전 지갑 옮기기: 기한 안에 처음 들어온 이름만 ---------- */
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

/* ---------- 4) 결투 레벨 · 패배자 칭호 ---------- */
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

/* ---------- 5) 지갑 표 직접 쓰기 다시 막기 ---------- */
drop policy if exists "wallets insert" on public.wallets;
drop policy if exists "wallets update" on public.wallets;
revoke insert, update, delete on public.wallets from anon, authenticated;
revoke all on public.duel_bets from anon, authenticated;

grant execute on function public.duel_stake(text, text, text, double precision, text), public.duel_stats_save(text, text, int, boolean, int, int, text, int) to anon, authenticated;
revoke execute on function public._duel_resolve(text) from anon, authenticated, public;
notify pgrst, 'reload schema';
