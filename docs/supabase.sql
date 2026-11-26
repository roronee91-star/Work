/* 휴대폰에서 복사하다 줄바꿈이 사라져도 그대로 실행되도록 설명은 모두 이 괄호 모양으로 적었어요. */
/* 공지판용 표. Supabase 대시보드 > SQL Editor에서 실행하세요. */
/* 이 파일 전체를 몇 번 다시 실행해도 괜찮아요 (이미 있는 표·자료는 그대로 둠). */
create table if not exists public.notices (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) <= 60),
  body text check (char_length(body) <= 400),
  author text check (char_length(author) <= 16),
  created_at timestamptz not null default now()
);
alter table public.notices enable row level security;
/* 누구나 읽고 올릴 수 있음 (수정·삭제는 대시보드에서만) */
drop policy if exists "notices read" on public.notices;
create policy "notices read" on public.notices for select using (true);
drop policy if exists "notices insert" on public.notices;
create policy "notices insert" on public.notices for insert with check (true);
grant select, insert on public.notices to anon, authenticated;

/* ⚔️ 결투 레벨 · 패배자 칭호 (이름별). 이것도 SQL Editor에서 한 번 실행하세요. */
/* 이 표가 없으면 레벨은 예전처럼 각자 기기에만 저장됩니다. */
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
alter table public.duel_stats enable row level security;
/* 누구나 읽기만. 레벨 · 칭호를 바꾸는 건 docs/security.sql의 duel_stats_save 함수로만 (주인만, 한 판씩) */
drop policy if exists "duel read" on public.duel_stats;
create policy "duel read" on public.duel_stats for select using (true);
drop policy if exists "duel insert" on public.duel_stats;
drop policy if exists "duel update" on public.duel_stats;
revoke insert, update, delete on public.duel_stats from anon, authenticated;
grant select on public.duel_stats to anon, authenticated;

/* 📋 업무 요청. 이것도 SQL Editor에서 한 번 실행하세요. */
/* 이 표가 없으면 업무 요청은 각자 브라우저에만 저장됩니다(다른 사람에게 안 감). */
create table if not exists public.requests (
  id bigint generated always as identity primary key,
  from_name text not null check (char_length(from_name) <= 16),
  to_name text not null check (char_length(to_name) <= 16),
  title text not null check (char_length(title) <= 60),
  body text check (char_length(body) <= 500),
  due date,
  status text not null default '요청' check (status in ('요청', '진행', '완료')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists requests_to on public.requests (to_name, created_at desc);
create index if not exists requests_from on public.requests (from_name, created_at desc);
alter table public.requests enable row level security;
drop policy if exists "requests read" on public.requests;
create policy "requests read" on public.requests for select using (true);
drop policy if exists "requests insert" on public.requests;
create policy "requests insert" on public.requests for insert with check (true);
drop policy if exists "requests update" on public.requests;
create policy "requests update" on public.requests for update using (true) with check (true);
/* 바꿀 수 있는 건 상태와 시각뿐 (제목·내용·보낸 사람은 못 고침, 지우기는 대시보드에서만) */
grant select, insert on public.requests to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
revoke update on public.requests from anon, authenticated;
grant update (status, updated_at) on public.requests to anon, authenticated;
/* 화면에 바로 반영되도록 서버 목록 새로 고침 */
notify pgrst, 'reload schema';

/* 💰 월급 · 지갑 · 💹 투자 (게임 속 가상 돈). 이것도 SQL Editor에서 실행하세요. */
/* 이 표가 없으면 지갑은 각자 브라우저에만 저장됩니다. 지갑 · 결투 레벨을 서버에 저장하려면 이 파일 다음에 docs/security.sql도 실행하세요. */
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
alter table public.wallets enable row level security;
/* 누구나 읽기만. 돈이 바뀌는 일은 docs/security.sql의 서버 함수로만 (이 파일을 다시 실행해도 직접 고치기가 다시 열리지 않음) */
drop policy if exists "wallets read" on public.wallets;
create policy "wallets read" on public.wallets for select using (true);
drop policy if exists "wallets insert" on public.wallets;
drop policy if exists "wallets update" on public.wallets;
revoke insert, update, delete on public.wallets from anon, authenticated;
grant select on public.wallets to anon, authenticated;
notify pgrst, 'reload schema';
