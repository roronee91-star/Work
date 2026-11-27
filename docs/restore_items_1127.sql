/* 🎁 사라진 아이템 되돌리기 (11-27 제보: 먀먀 · 김아무개 · 룽)
   원인(추정): 서버 지갑으로 옮길 때 '처음 들어온 기기'의 아이템만 한 번 가져옴 → 다른 기기에서 산 아이템이 빠짐
   Supabase → SQL Editor에 붙여 넣고 Run. 여러 번 실행해도 안전 (이미 있으면 그대로)
   ⚠️ 이름은 사이트에서 쓰는 이름과 글자 하나까지 같아야 해요. 결과에 사람이 안 나오면 이름을 알려 주세요 */
with fix(name, item, slot) as (values
  ('먀먀', 'gucicardi', 'body'),   /* 구치 니트 가디건 */
  ('김아무개', 'santa', 'head'),    /* 산타 모자 */
  ('룽', 'halo', 'top')             /* 천사 고리 */
)
update wallets w set stocks = jsonb_set(
    jsonb_set(coalesce(w.stocks, '{}'::jsonb), '{__items}',
      case when coalesce(w.stocks -> '__items', '[]'::jsonb) ? f.item then coalesce(w.stocks -> '__items', '[]'::jsonb) else coalesce(w.stocks -> '__items', '[]'::jsonb) || to_jsonb(f.item) end),
    '{__wear}', coalesce(w.stocks -> '__wear', '{}'::jsonb) || jsonb_build_object(f.slot, f.item)),
  updated_at = now()
from fix f where w.name = f.name;

/* 결과: 세 사람의 지갑 (아이템 · 착용) — 비어 있으면 이름이 다른 것 */
select name, stocks -> '__items' as items, stocks -> '__wear' as wear, imported from wallets
where name in ('먀먀', '김아무개', '룽') or name like '%먀%' or name like '%룽%' or name like '%김아무개%';
