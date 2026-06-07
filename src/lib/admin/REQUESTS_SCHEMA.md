# `requests` 테이블 스키마 (백오피스 참고)

> **갱신(2026-06-07):** 이 테이블은 이제 **`007a_requests_content_id.sql` / `007b_requests_rls_hardening.sql`** 가 단일 출처다(멱등 *제자리 강화*). 과거 "마이그레이션에 없음/재생성 금지" 메모는 폐기 — 단, **파괴적 `DROP`/재생성은 여전히 금지**하고 멱등 보강만 한다(`007a/007b`에 DROP 없음).
> 추가된 것: `content_id`(→`contents.id`, `on delete set null`) 연결, RLS(익명 INSERT-only) + 공개-INSERT 보호 트리거(공개 롤의 `content_id`→null·`status`→'pending' 강등), **D2 편집요청 검증 RPC `submit_edit_request`**(익명이 보낸 `content_id`를 서버 검증 후 보존).

사용자는 `src/app/actions/requests.ts`를 통해 제출한다 — **add = 직접 INSERT**(content_id 없음), **edit = `submit_edit_request` RPC**(content_id 함께, D2). 백오피스는 **status + content_id 연결**을 관리한다(카탈로그 자동 승격 없음).

## 라이브 스키마 조회 방법

service_role(또는 POSTGRES_URL) 권한으로 아래를 실행:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'requests'
order by ordinal_position;

-- 제약 확인(특히 status에 CHECK가 있는지)
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.requests'::regclass;
```

## 실측 결과 (2026-06-05, 라이브 DB 직접 조회)

| column        | type                     | nullable | default                          |
| ------------- | ------------------------ | -------- | -------------------------------- |
| id            | uuid                     | NO       | `gen_random_uuid()`              |
| created_at    | timestamptz              | NO       | `timezone('utc', now())`         |
| type          | text                     | NO       | — (`'add'` \| `'edit'`)          |
| video_title   | text                     | YES      |                                  |
| link          | text                     | YES      |                                  |
| request_type  | text                     | YES      |                                  |
| category      | text                     | YES      |                                  |
| generation    | text                     | YES      |                                  |
| description   | text                     | YES      |                                  |
| status        | text                     | YES      | `'pending'`                      |

제약: `requests_pkey PRIMARY KEY (id)` 뿐. **status에 CHECK 제약이 없다** —
즉 `pending | approved | rejected | done` 값을 넣는 데 스키마 변경이 **불필요**하다.
(현재 데이터: status는 전부 `pending` 4건, type은 `add` 2 / `edit` 2.)

## UI/백엔드 가이드

- `id`, `created_at` 둘 다 존재 → 목록은 `created_at desc`로 정렬 가능.
  그래도 repo는 방어적으로: created_at 정렬 실패 시 id 정렬로 폴백한다.
- `type`에 따라 의미 있는 컬럼이 다르다:
  - `add`: link, category, generation, description
  - `edit`: video_title, request_type, category, generation, description
  UI는 선택 컬럼(video_title/link/request_type 등)이 null일 수 있으니 방어적으로 렌더.
- status 허용 값(앱 컨벤션): `pending | approved | rejected | done`.
  DB CHECK가 없으므로 검증은 **앱 레이어**(repo의 `REQUEST_STATUSES`)에서 한다.
- 추가 스키마 변경이 필요해질 경우에도 **ADDITIVE-only**(컬럼 추가/인덱스)만,
  재생성 금지. 현재로선 변경 불필요.
