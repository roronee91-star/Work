/* ⛄ 눈사람 마당 (11-26). security.sql을 실행한 Supabase에서 SQL Editor에 붙여 넣고 Run. 여러 번 실행해도 안전
   이상한 그림이 있으면: Table Editor → snowmen 표에서 그 줄을 지우면 돼요 */
create table if not exists public.snowmen (
  id bigserial primary key, owner text not null, x real not null, z real not null, r1 real not null, r2 real not null, ry real not null default 0,
  face text not null check (char_length(face) <= 60000), created_at timestamptz not null default now()
);
alter table public.snowmen enable row level security;
drop policy if exists "snowmen read" on public.snowmen;
create policy "snowmen read" on public.snowmen for select using (true);
revoke insert, update, delete on public.snowmen from anon, authenticated;
grant select on public.snowmen to anon, authenticated;

/* 세우기: 지갑 주인 확인 · 한 사람 3개 · 마당 30개 · 마당 안 · 크기 범위 · 얼굴은 PNG 그림만 */
create or replace function public.snowman_add(p_name text, p_key text, p_x real, p_z real, p_r1 real, p_r2 real, p_ry real, p_face text) returns snowmen language plpgsql security definer set search_path = public as $$
declare s snowmen;
begin
  perform _auth(p_name, p_key);
  perform pg_advisory_xact_lock(hashtext('snowmen'));
  if (select count(*) from snowmen where owner = p_name) >= 3 then raise exception 'too_many'; end if;
  if (select count(*) from snowmen) >= 30 then raise exception 'yard_full'; end if;
  if p_x < -23 or p_x > -11.5 or p_z < -25 or p_z > -11.5 then raise exception 'bad_place'; end if;
  if p_r1 < 0.25 or p_r1 > 0.5 or p_r2 < 0.14 or p_r2 > p_r1 then raise exception 'bad_size'; end if;
  if p_face is null or left(p_face, 22) <> 'data:image/png;base64,' or char_length(p_face) > 60000 then raise exception 'bad_face'; end if;
  insert into snowmen (owner, x, z, r1, r2, ry, face) values (p_name, p_x, p_z, p_r1, p_r2, coalesce(p_ry, 0), p_face) returning * into s;
  return s;
end $$;

/* 부수기: 만든 사람만 */
create or replace function public.snowman_smash(p_name text, p_key text, p_id bigint) returns void language plpgsql security definer set search_path = public as $$
begin
  perform _auth(p_name, p_key);
  delete from snowmen where id = p_id and owner = p_name;
  if not found then raise exception 'not_yours'; end if;
end $$;

grant execute on function public.snowman_add(text, text, real, real, real, real, real, text), public.snowman_smash(text, text, bigint) to anon, authenticated;
notify pgrst, 'reload schema';
