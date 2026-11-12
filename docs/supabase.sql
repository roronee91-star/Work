-- 공지판용 표. Supabase 대시보드 > SQL Editor에서 한 번 실행하세요.
create table if not exists public.notices (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) <= 60),
  body text check (char_length(body) <= 400),
  author text check (char_length(author) <= 16),
  created_at timestamptz not null default now()
);
alter table public.notices enable row level security;
-- 누구나 읽고 올릴 수 있음 (수정·삭제는 대시보드에서만)
create policy "notices read" on public.notices for select using (true);
create policy "notices insert" on public.notices for insert with check (true);

-- ⚔️ 결투 레벨 · 패배자 칭호 (이름별). 이것도 SQL Editor에서 한 번 실행하세요.
-- 이 표가 없으면 레벨은 예전처럼 각자 기기에만 저장됩니다.
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
-- 누구나 읽고, 자기 기록을 올리고 고칠 수 있음 (지우기는 대시보드에서만)
create policy "duel read" on public.duel_stats for select using (true);
create policy "duel insert" on public.duel_stats for insert with check (true);
create policy "duel update" on public.duel_stats for update using (true) with check (true);
