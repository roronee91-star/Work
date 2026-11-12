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
