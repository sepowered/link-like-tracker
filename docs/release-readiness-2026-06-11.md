# 프로덕션 전환 준비 보고서 — "지금 이대로 배포했다면" (2026-06-11)

대상: `preview` 브랜치 (admin 백오피스 + 시청기록 동기화 하드닝 병합 완료 시점)
하드 제약: **기존 유저 시청 데이터(원격 user_progress 4유저 839행, 비회원 localStorage)의 손실·덮어쓰기 금지** — 모든 판단의 최우선 기준.

---

## 1. 개선 전 상태로 배포했다면 실제로 발생했을 문제

### 심각 (데이터 유실·변조)

1. **"이 기기 기록으로 맞추기"·"기기 기록 가져오기" 중 원격 전체 유실 창.**
   `mergeAllDevices('local')`과 `adoptDeviceProgress`가 **원격 전체 삭제 → 업로드** 순서였다.
   삭제 직후 업로드가 실패하면(네트워크 끊김, 토큰 만료, Supabase 장애) 그 계정의
   원격 시청 기록 전부가 사라졌다. 특히 업로드가 마이그레이션 펜스에 걸려 *조용히
   건너뛰어지는* 경우엔 에러조차 없이 삭제만 실행됐다.
   → 수정: 업로드가 **실제 실행·성공**한 것을 확인한 뒤에만 삭제. `fencedUpload`가
   실행 여부를 반환하고, adopt는 펜스가 닫혀 있으면 작업 자체를 중단한다.

2. **분할 영상 unwatch가 영원히 안 먹히는 부활 루프.**
   원격 병합(`remoteToEntries`)이 watched-union(시청이 무조건 승리)이라,
   마이그레이션 후 동결된 레거시 행(watched)이 사용자의 *의도적인 unwatch*를
   매 동기화마다 다시 watched로 되돌렸다. 같은 이유로 매 로그인마다
   "기기마다 기록이 달라요" 가짜 충돌 시트가 반복해서 떴다.
   → 수정: LWW(최신 기록 승리, 타임스탬프 동률이면 watched 우선)로 변경.
   마이그레이션 의미(레거시 watched → 모든 파트 watched)는 유지됨을 시뮬레이션으로 검증.

3. **비회원 레거시 기록의 소리 없는 증발.**
   `PlaylistView.saveToLocalStorage`가 체크 한 번에 `llt-watched` 전체를 현재
   카탈로그 기준으로 재작성했다. 카탈로그에서 삭제된 콘텐츠·아주 오래된 ID 등
   "카탈로그가 모르는" 기록은 그 시점에 영구 유실. 백오피스에서 콘텐츠를 지우면
   전 비회원의 해당 시청 기록이 다음 체크 한 번에 사라지는 구조였다.
   → 수정: ① 원본을 불변 백업 키(`llt-legacy-backup-v1`)에 1회 보존,
   ② 재작성 시 모르는 ID는 그대로 보존(비파괴 미러), ③ `writeLegacyKeys`도 동일.

4. **인증 없는 전역 카탈로그 변조 API.**
   `/api/playlist/[videoId]` PATCH가 어떤 인증도 없이 노출돼 있었고, Supabase
   카탈로그 모드에서는 service_role로 `contents.category_override`를 직접
   수정했다 — 아무 방문자나 전 유저의 카탈로그 분류를 바꿀 수 있었다.
   호출처가 전혀 없는 데드 코드였으므로 라우트를 삭제했다.

### 중간 (기능 결함·신뢰성)

5. **과잉 충돌 프롬프트.** `hasConflict`가 "엔트리 개수 차이"만으로 충돌 판정 —
   오프라인에서 영상 1개만 체크해도 다음 로그인에 충돌 시트가 떴고, 사용자가
   무심코 "저장된 기록으로 맞추기"를 고르면 새 기록이 날아갔다(유실 트리거 UX).
   → 진짜 status 불일치만 충돌로 판정, 단순 집합 차이는 보존적 자동 병합.

6. **Supabase 카탈로그 단일 장애점.** `CATALOG_SOURCE=supabase`로 전환한 뒤
   Supabase가 죽거나 시드가 안 돼 있으면 메인 화면 자체가 빈 화면/500.
   → 실패·빈 결과 시 번들 JSON 폴백.

7. **목표 4 미충족: 비회원의 새 기록이 Supabase에 저장되지 않음.**
   비회원은 `saveVideoProgress`가 `if (!user) return`으로 끊겨 영원히
   localStorage 전용이었다. → lazy 익명 인증(`signInAnonymously`) 도입으로
   비회원 새 기록도 content.id 방식으로 Supabase에 저장. 실패 시 기존
   localStorage 경로 그대로(폴백), `NEXT_PUBLIC_ANON_SYNC=disabled` 킬 스위치,
   읽기전용 preview에서는 익명 가입 차단.

8. **익명 세션이 "로그인됨"으로 보이는 UI 혼란(신규 도입에 따른 예방).**
   설정/기기관리 화면이 `user` 존재만으로 회원 UI를 노출 — 익명 유저가
   "연결됨"·기기 목록·로그아웃을 보게 될 상황. → `isMember`(비익명) 게이팅 추가.

### 경미 (운영·성능)

9. **포커스 복귀마다 전체 upsert.** visibility 동기화가 변경 여부와 무관하게
   매번 전체 스토어를 업로드 — 공유 프로덕션 DB에 불필요한 쓰기 트래픽.
   → 변경분이 있을 때만 업로드.

10. **카탈로그 FK 인덱스 부재.** episodes.season_id, contents.episode_id,
    content_sources.content_id에 인덱스가 없어 중첩 조회·cascade 삭제가 풀스캔.
    감사 타임스탬프(created_at/updated_at)도 없어 백오피스 편집 추적 불가.
    → 008 마이그레이션(전부 추가적·멱등)으로 보강.

---

## 2. 목표별 충족 상태

| 목표 | 상태 |
|---|---|
| 1. 콘텐츠 데이터 구조 개선 | ✅ 008 마이그레이션 (FK 인덱스 + 타임스탬프 + 트리거, 기존 행 무변형) |
| 2. JSON기반 로그인 유저·localStorage 유저 무사고 | ✅ legacy-map 확장 + 마이그레이션 펜스 유지, LWW 수정으로 부활 루프 제거 |
| 3. localStorage 하위호환 + 덮어쓰기 금지 | ✅ 불변 백업 + 비파괴 미러 재작성 (모르는 ID 보존) |
| 4. 비회원도 새 데이터는 Supabase·content.id | ✅ lazy 익명 인증, 레거시 데이터는 일절 덮어쓰지 않음 |
| 5. 실패 시 legacy 폴백 | ✅ 로컬 우선 저장 + 익명 가입 실패 시 localStorage 유지 + 전체 upsert 재동기화 + 카탈로그 JSON 폴백 |

검증: `next build` 통과, 변경 파일 lint 클린(기존 베이스라인 제외), 동기화 순수 함수
(충돌 판정·병합·v1 마이그레이션·분할 확장·백업 불변성) 실행 테스트 전건 통과,
별도 리뷰어 패스(blocker 0건; MAJOR 지적 3건 중 2건 코드 반영, 1건은 아래 §4).

---

## 3. 실제 배포(승격) 전 운영 체크리스트

1. **Supabase 대시보드에서 Anonymous Sign-ins 활성화** — 꺼져 있으면 비회원
   Supabase 저장은 조용히 폴백(localStorage)으로만 동작한다(기능 저하일 뿐 무해).
2. SQL 에디터에서 미적용 마이그레이션 순서대로 적용: 002→003(미적용 확인됨),
   004~007(이미 수동 적용 여부 확인), **008(신규)**. 007b는 파일 내 PRE-FLIGHT/probe 절차 준수.
3. 프로덕션 env: `NEXT_PUBLIC_PROGRESS_READONLY` **해제**(preview 스코프에만 유지),
   `CATALOG_SOURCE=supabase` 전환은 카탈로그 시드(`scripts/seed-catalog.ts`) 후.
4. 서버 백필(`scripts/backfill-progress.ts`)은 승격 시점에 dry-run → 실제 실행 (기존 계획 유지).
5. 익명 유저 행 정리는 **시청 데이터 cascade 삭제를 유발**하므로, 정리 정책을
   정하기 전까지 대시보드의 "Clean up anonymous users"를 누르지 말 것.
   (localStorage가 원본이라 복구는 가능하지만 원칙적으로 금지.)

## 4. 알려진 트레이드오프 (의도된 결정)

- **익명 → OAuth 로그인 시 익명 uid의 원격 행은 고아로 남는다.** 데이터 자체는
  레거시 키 미러를 타고 회원 계정으로 흡수되므로 유실은 아니다(코드 주석 명문화).
  고아 행 정리는 운영 작업으로 분리.
- **contents에 (episode_id, sort_order) UNIQUE 없음** — 006 import가 단순 부여
  방식이라 의도적으로 미적용. 동시 편집이 거의 없는 1인 운영 백오피스라 수용.
- **user_progress.category_override가 기기 단위로 중복** — 배포된 테이블(4유저
  839행)이라 구조 변경은 보류, 추가적 개선만 수행. 동작에는 문제 없음.
- **user_progress.video_id에 FK 없음** — 의도적(레거시/삭제된 콘텐츠 기록 보존).
  008에 COMMENT로 문서화.
