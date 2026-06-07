-- 007b_requests_rls_hardening.sql
-- RLS 활성화 + 익명 INSERT-only 정책 + 공개-INSERT 보호 트리거 + D2 편집요청 검증 RPC.
--
-- ★ 권한 경계를 바꾸는 클래스(공개 폼에 영향). 적용 순서/검증:
--   (1) 007a 를 먼저 적용(트리거/RPC가 content_id 컬럼을 참조).
--   (2) 적용 전 아래 PRE-FLIGHT(읽기 전용)로 RLS 실태/INSERT 권한 확인 — 출력 저장 = 롤백 기준선.
--   (3) 적용 직후 아래 익명 probe 를 필수 게이트로 통과.
--   (4) 문제 시 하단 EMERGENCY ROLLBACK 즉시.
-- 멱등(재실행 안전): 전부 grant/enable/replace/drop-create 형태. ★ revoke 없음 → 권한 공백 없음.

begin;

-- (a) 권한 정리 — 공개 롤(anon/authenticated)에는 INSERT만 남긴다.
--     PRE-FLIGHT(2026-06-07): anon/authenticated 가 SELECT/UPDATE/DELETE/TRUNCATE 까지 보유 + RLS off
--     → 공개 키로 요청을 읽기/수정/삭제/전체삭제(TRUNCATE) 할 수 있는 상태였다. 이를 닫는다.
--     ★ TRUNCATE 는 RLS 로 막히지 않으므로(행 단위 아님, 테이블 권한) 반드시 '회수'해야 한다.
--     INSERT 는 건드리지 않으므로 폼 권한 공백 없음(추가 요청 무중단).
grant insert on public.requests to anon, authenticated;            -- 보장(멱등)
revoke select, update, delete, truncate, references, trigger
  on public.requests from anon, authenticated;

-- (b) RLS 활성화 + INSERT 전용 정책(같은 트랜잭션 → 'RLS on·정책 없음' 반쪽 상태 불가).
--     SELECT/UPDATE/DELETE 정책 없음 → service_role(백오피스)만 읽고 고친다. 익명 조회 차단.
alter table public.requests enable row level security;
drop policy if exists "requests anon insert" on public.requests;
create policy "requests anon insert" on public.requests
  for insert to anon, authenticated
  with check (true);

-- (c) 공개 롤(anon/authenticated) 직접 INSERT 보호 트리거 (in-band — grant-all 복원에도 면역).
--     - content_id : 공개 롤은 임의 연결 금지 → null 강등. (검증된 연결은 submit_edit_request RPC 전용)
--     - status     : 공개 롤은 항상 'pending' → '완료' 등 위조 차단(#7).
--     service_role(관리자 UPDATE)·SECURITY DEFINER RPC(소유자=postgres)는 current_user 가 달라 보존됨.
--     ※ service_role 은 RLS 는 우회하나 '트리거'는 우회 못 하므로 여기서 명시 보존이 필요.
create or replace function public.requests_guard_anon_insert()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.content_id := null;        -- 검증 안 된 연결 차단(연결은 RPC 전용)
    new.status     := 'pending';   -- status 위조 차단(#7)
  end if;
  return new;
end;
$$;

drop trigger if exists trg_requests_guard_anon_insert on public.requests;
create trigger trg_requests_guard_anon_insert
  before insert on public.requests
  for each row execute function public.requests_guard_anon_insert();

-- (d) D2 편집요청 RPC — 익명이 보낸 content_id 를 '서버 검증 후' 보존하는 유일한 경로.
--     SECURITY DEFINER(소유자=postgres) → (c) 트리거의 강등을 받지 않아 content_id/status 보존.
--     set search_path='' + 모든 객체 schema-qualified → search_path 하이재킹 방지.
--     ※ 이는 006_import_catalog(INVOKER, service_role 호출)과 다른 보안 모델이다(익명 노출이므로 DEFINER 잠금 필수).
create or replace function public.submit_edit_request(
  p_content_id   text,
  p_video_title  text,
  p_request_type text,
  p_category     text,
  p_generation   text,
  p_description  text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 존재하지 않는 콘텐츠면 거부(FK 도 막지만 명확한 에러를 위해 선검증).
  if p_content_id is null
     or not exists (select 1 from public.contents where id = p_content_id) then
    raise exception 'submit_edit_request: invalid content_id %', p_content_id
      using errcode = '22023';
  end if;

  insert into public.requests
    (type, content_id, video_title, request_type, category, generation, description, status)
  values
    ('edit', p_content_id, p_video_title, p_request_type, p_category, p_generation, p_description, 'pending');
end;
$$;

-- 실행 권한: 공개 롤만 EXECUTE.
revoke all     on function public.submit_edit_request(text,text,text,text,text,text) from public;
grant  execute on function public.submit_edit_request(text,text,text,text,text,text) to anon, authenticated;

commit;

-- ─── PRE-FLIGHT (적용 전 1회, 읽기 전용 — 결과 저장 = 롤백 기준선) ───────────────────────────
--   select relname, relrowsecurity from pg_class where relname='requests';            -- false면 현재 익명 SELECT 누수 존재
--   select grantee, privilege_type from information_schema.role_table_grants where table_name='requests';
--
-- ─── 익명 probe (적용 직후 필수 게이트, 공개 anon 키로) ─────────────────────────────────────
--   1) insert-ok      : POST /rest/v1/requests {type:'add',link,...}            → 201
--   2) select-blocked : GET  /rest/v1/requests?select=*                          → 0행/401-403
--   3) content_id 강등 : POST /rest/v1/requests {type:'edit',content_id:'X',...}  → 201, 이후 service_role로 그 행 content_id IS NULL 확인
--   4) edit RPC 보존  : POST /rest/v1/rpc/submit_edit_request {유효 content_id,...} → 204, 그 행 content_id 보존 확인
--
-- ─── EMERGENCY ROLLBACK (폼 장애 시 즉시) ──────────────────────────────────────────────────
--   grant insert on public.requests to anon, authenticated;                       -- 이미 부여돼 있으나 안전망
--   alter table public.requests disable row level security;                       -- RLS 자체가 의심되면
--   drop trigger if exists trg_requests_guard_anon_insert on public.requests;      -- 트리거가 의심되면
