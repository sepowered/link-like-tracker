-- 005_admin_users.sql — 백오피스 관리자 멤버십 테이블
-- admin_users에 행이 있는 auth.users만 백오피스(/admin) 접근 및 쓰기 권한을 가진다.
-- 쓰기는 service_role 전용(쓰기 정책 없음). 본인 행 SELECT만 허용.
-- Supabase migration history가 없는 기존 수동 적용 DB에서도 재실행 가능해야 한다(멱등).

create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table admin_users enable row level security;

-- 본인 행만 읽을 수 있다(자신이 관리자인지 확인 용도). 쓰기 정책은 없으므로 service_role만 쓴다.
drop policy if exists "admin_users self read" on admin_users;

create policy "admin_users self read" on admin_users
  for select using (user_id = auth.uid());

-- 첫 관리자 수동 시드 예시(service_role 또는 SQL 에디터에서 실행):
--   insert into admin_users (user_id, email)
--   select id, email from auth.users where email = 'admin@example.com'
--   on conflict (user_id) do nothing;
