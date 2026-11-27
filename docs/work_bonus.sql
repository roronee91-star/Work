/* 💼 시급 2배 (11-27): 2층에서 '💻 일하기' 중이면 오전 11시 ~ 오후 5시(한국 시간)에 시급 2배
   Supabase → SQL Editor에 붙여 넣고 Run. 여러 번 실행해도 안전.
   p_work = 지난 기록 뒤로 계속 일하기 중이었는지(화면이 알려 줌). 시간대는 서버 시계로 다시 확인. */
drop function if exists public.wallet_tick(text, text);
create or replace function public.wallet_tick(p_name text, p_key text, p_work boolean default false) returns wallets language plpgsql security definer set search_path = public as $$
declare w wallets; secs double precision; add double precision; h int; r double precision := 1;
begin
  perform _auth(p_name, p_key); w := _wallet(p_name);
  secs := coalesce(extract(epoch from now() - w.last_tick), 0);
  if w.last_tick is null or secs > 300 then secs := 0; end if;
  add := greatest(0, least(secs, 90, 43200 - w.day_secs));
  h := extract(hour from now() at time zone 'Asia/Seoul');
  if coalesce(p_work, false) and h >= 11 and h < 17 then r := 2; end if;
  w.day_secs := w.day_secs + floor(add); w.day_pay := w.day_pay + add * r * 10320 / 3600.0; w.cash := w.cash + add * r * 10320 / 3600.0; w.last_tick := now();
  return _save(w);
end $$;
revoke execute on function public.wallet_tick(text, text, boolean) from public;
grant execute on function public.wallet_tick(text, text, boolean) to anon, authenticated;
