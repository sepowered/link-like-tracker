-- 007a_requests_content_id.sql — requests 스키마 정식화(추가적/무해) + 카탈로그 연결 컬럼
--
-- 이 클래스는 권한/RLS를 건드리지 않아 공개 요청 폼을 절대 깨지 않는다(near-zero risk).
-- 멱등: 새 DB는 아래 모양대로 생성, 기존 prod 테이블은 제자리 보강(데이터 보존). DROP TABLE 없음.
-- requests는 그동안 마이그레이션 밖(수동 생성)이었고, 이 파일(+007b)이 이제 단일 출처다.
-- ★ RLS/익명 권한/content_id 트리거는 짝이 되는 007b_requests_rls_hardening.sql 에서 처리한다.

-- 1) 새 DB용 완전 정의 (기존 테이블이 있으면 통째로 건너뜀)
create table if not exists public.requests (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default timezone('utc', now()),
  type         text not null,
  video_title  text,
  link         text,
  request_type text,
  category     text,
  generation   text,
  description  text,
  status       text not null default 'pending',
  content_id   text                       -- 카탈로그 연결(nullable). 채우는 시점: edit=제출 RPC(D2), add=승격.
);

-- 2) 기존 prod 테이블 제자리 보강 (모두 추가적/무해)
alter table public.requests add column if not exists content_id text;
alter table public.requests alter column status set default 'pending';  -- 이미 default 'pending'이면 멱등 no-op
update public.requests set status = 'pending' where status is null;     -- 현재 0행 영향(전부 pending)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'requests'
               and column_name = 'status' and is_nullable = 'YES') then
    alter table public.requests alter column status set not null;
  end if;
end $$;

-- 3) CHECK 제약 (기존 데이터: type ∈ add/edit, status = pending → 즉시 통과)
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'requests_type_check'
                   and conrelid = 'public.requests'::regclass) then
    alter table public.requests
      add constraint requests_type_check check (type in ('add', 'edit'));
  end if;
  if not exists (select 1 from pg_constraint
                 where conname = 'requests_status_check'
                   and conrelid = 'public.requests'::regclass) then
    alter table public.requests
      add constraint requests_status_check
      check (status in ('pending', 'approved', 'rejected', 'done'));
  end if;
end $$;

-- 4) 카탈로그 FK: content_id → contents(id) (TEXT, contents.id는 앱상 불변)
--    on delete set null : 콘텐츠 삭제 시 요청 이력은 남기고 연결만 끊는다.
--    on update cascade  : id가 바뀌어도 자동 추종(방어). 폼은 content_id 미전송 → null → FK 무관.
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'requests_content_id_fkey'
                   and conrelid = 'public.requests'::regclass) then
    alter table public.requests
      add constraint requests_content_id_fkey
      foreign key (content_id) references public.contents(id)
      on delete set null on update cascade;
  end if;
end $$;

create index if not exists idx_requests_content_id on public.requests(content_id);
create index if not exists idx_requests_status     on public.requests(status);
