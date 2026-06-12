-- 009_announcements.sql
-- 공지(업데이트 노트) 테이블 + RLS.
--
-- 공개 페이지(/updates, 메인 배너)는 is_published = true 행만 anon 으로 읽고,
-- 작성/수정/삭제는 백오피스 서버 액션(service_role)만 수행한다.
-- 멱등(재실행 안전): create if not exists / drop-create policy / grant·revoke 형태.

begin;

create table if not exists public.announcements (
  slug         text primary key,
  title        text not null,
  banner_title text,
  summary      text not null,
  body_md      text not null,
  published_at date not null,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- (a) 권한 정리 — 공개 롤은 SELECT만. 쓰기는 service_role 전용.
grant select on public.announcements to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.announcements from anon, authenticated;

-- (b) RLS: 게시된 행만 공개 조회. 쓰기 정책 없음 → service_role 만 변경 가능.
alter table public.announcements enable row level security;
drop policy if exists "announcements public read published" on public.announcements;
create policy "announcements public read published" on public.announcements
  for select to anon, authenticated
  using (is_published);

-- (c) updated_at 자동 갱신.
create or replace function public.announcements_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_announcements_touch_updated_at on public.announcements;
create trigger trg_announcements_touch_updated_at
  before update on public.announcements
  for each row execute function public.announcements_touch_updated_at();

commit;
