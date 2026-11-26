/* 🏘 부동산 분양 · 🛋 가구점 종료 환불 (11-27). Supabase → SQL Editor에 붙여 넣고 Run. 여러 번 실행해도 한 번만 돌려줌
   - 집: 산 값 - (되판 값) = 손해 본 금액을 모두 돌려줌, 집 기록은 지움
   - 가구: 산 값 전부 돌려줌, 가구 · 배치 기록은 지움 */
do $$
declare r record;
begin
  /* 산 값 - 되판 값 - 이미 돌려준 값 = 아직 못 돌려받은 금액 (몇 번을 실행해도 그만큼만) */
  for r in select name, -sum(amount) as loss from wallet_ledger where kind in ('estate', 'estate_sell', 'estate_refund') group by name loop
    if r.loss > 0 then
      update wallets set cash = cash + r.loss where name = r.name;
      insert into wallet_ledger (name, kind, amount, day, ref) values (r.name, 'estate_refund', r.loss, _kst_day(), 'closed');
    end if;
  end loop;
  delete from estates;
  for r in select name, -sum(amount) as spent from wallet_ledger where kind in ('furn', 'furn_refund') group by name loop
    if r.spent > 0 then
      update wallets set cash = cash + r.spent, stocks = (stocks - '__furn') - '__home' where name = r.name;
      insert into wallet_ledger (name, kind, amount, day, ref) values (r.name, 'furn_refund', r.spent, _kst_day(), 'closed');
    end if;
  end loop;
end $$;
/* 더 이상 사지 못하게 함수 막기 (다시 열 때는 estate.sql · furniture.sql을 다시 실행) */
revoke execute on function public.estate_buy(text, text, text, int), public.furn_buy(text, text, text) from anon, authenticated, public;
notify pgrst, 'reload schema';
/* 결과 보기: 누가 얼마 돌려받았는지 */
select name, kind, amount from wallet_ledger where kind in ('estate_refund', 'furn_refund') order by name;
