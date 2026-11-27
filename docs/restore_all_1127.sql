/* 📦 모두의 예전 아이템 되찾기 (11-27, 사용자: '유저들이 갖고 있던 거 다 돌려줘')
   서버 지갑으로 옮길 때(300만 원 한도 · 처음 기기만) 빠진 아이템을, 각 기기에 남아 있는 예전 지갑에서 다시 받아 줌.
   - 사이트에 들어오면 그 기기의 예전 아이템 중 서버에 없는 것만 보냄 → 서버가 진짜 상품(가격 있는 것)만 덧붙임. 돈은 안 줌.
   - 한 사람 합계 1,000만 원어치까지 · 12월 4일 0시까지만 열림 · 빈 착용 칸에만 다시 입힘
   Supabase → SQL Editor에 붙여 넣고 Run. 여러 번 실행해도 안전. */
create or replace function public.wallet_restore_items(p_name text, p_key text, p_items jsonb, p_wear jsonb) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; its jsonb; wr jsonb; v text; k text; pr int; got double precision; added double precision := 0;
begin
  perform _auth(p_name, p_key); w := _wallet(p_name);
  if now() >= timestamptz '2026-12-04 00:00:00+09' then return w; end if;
  select coalesce(sum(amount), 0) into got from wallet_ledger where name = p_name and kind = 'restore';
  its := coalesce(w.stocks -> '__items', '[]'::jsonb);
  for v in select x from jsonb_array_elements_text(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) x loop
    pr := null; select price into pr from shop_prices where id = v;
    if pr is not null and pr > 0 and not its ? v and got + added + pr <= 10000000 then its := its || to_jsonb(v); added := added + pr; end if;
  end loop;
  if added = 0 then return w; end if;
  wr := coalesce(w.stocks -> '__wear', '{}'::jsonb);
  if jsonb_typeof(p_wear) = 'object' then
    for k, v in select key, value from jsonb_each_text(p_wear) loop if its ? v and not wr ? k then wr := wr || jsonb_build_object(k, v); end if; end loop;
  end if;
  w.stocks := jsonb_set(jsonb_set(coalesce(w.stocks, '{}'::jsonb), '{__items}', its), '{__wear}', wr);
  w := _save(w);
  insert into wallet_ledger (name, kind, amount, day) values (p_name, 'restore', added, _kst_day());
  return w;
end $$;
revoke execute on function public.wallet_restore_items(text, text, jsonb, jsonb) from public;
grant execute on function public.wallet_restore_items(text, text, jsonb, jsonb) to anon, authenticated;

/* 룽: 천사 날개 · 선글라스 (제보) — 바로 넣고 입힘 */
with fix(name, item, slot) as (values ('룽', 'wings', 'back'), ('룽', 'sunglasses', 'face'))
update wallets w set stocks = jsonb_set(jsonb_set(coalesce(w.stocks, '{}'::jsonb), '{__items}',
    case when coalesce(w.stocks -> '__items', '[]'::jsonb) ? f.item then coalesce(w.stocks -> '__items', '[]'::jsonb) else coalesce(w.stocks -> '__items', '[]'::jsonb) || to_jsonb(f.item) end),
  '{__wear}', coalesce(w.stocks -> '__wear', '{}'::jsonb) || jsonb_build_object(f.slot, f.item)), updated_at = now()
from fix f where w.name = f.name;

select name, stocks -> '__items' as items, stocks -> '__wear' as wear from wallets where name = '룽';
