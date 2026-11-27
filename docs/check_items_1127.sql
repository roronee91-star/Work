/* 🔎 아이템이 빠졌을 수 있는 사람 찾기 (읽기만 함, 아무것도 바꾸지 않음)
   옮길 때 '아이템+현금'을 합쳐 300만 원까지만 가져왔어요 → 아이템이 많던 사람은 일부가 빠졌을 수 있어요
   옮겨온 현금이 0원이면 300만 원 한도를 다 쓴 것 → 의심 */
select w.name,
  l.amount as 옮겨온현금,
  (select coalesce(sum(p.price), 0) from jsonb_array_elements_text(coalesce(w.stocks -> '__items', '[]'::jsonb)) x join shop_prices p on p.id = x) as 지금아이템값,
  w.stocks -> '__items' as 아이템,
  l.created_at as 옮긴시각
from wallets w join wallet_ledger l on l.name = w.name and l.kind = 'import'
order by l.amount asc, 3 desc;
