# V2 프로덕션 배포 체크리스트 (PR #35: preview → main)

기준: 2026-06-13, `preview@7d4ab31`. 배경은 [release-readiness-2026-06-11.md](release-readiness-2026-06-11.md) 참고.
하드 제약: **기존 시청 데이터(user_progress 5유저 1,394행 + 비회원 localStorage) 손실·덮어쓰기 금지.**

## 0. 사전 준비 — 완료된 항목 (2026-06-13 실측 확인)

- [x] DB 마이그레이션 적용: 003(auto_sync) · 005(admin_users) · 007b(requests RLS+가드 트리거) · **008(FK 인덱스 — 06-13 적용)** · **009(announcements — 06-12 적용)**
- [x] 카탈로그 시드: 콘텐츠 517 / 소스 797, 골든 픽스처(517/277) 통과
- [x] Supabase **Anonymous Sign-ins 활성화 확인** (probe로 실측, probe 유저는 삭제)
- [x] announcements RLS probe 3종 통과 (게시 행만 조회 / 익명 INSERT 거부 / 초안 비노출)
- [x] V2 공지 게시 상태 (`2026-06-v2`, is_published=true) — 배포일이 바뀌면 백오피스에서 게시일·본문 날짜 수정
- [x] `npm audit` 0건, 프로덕션 빌드 통과
- [x] 카탈로그 정합성: 자막 없는 story 행 56건 전수 확인(전부 일본어 전용 — 정당), 104기 7~12화 오라벨 정정 완료

## 1. 배포 직전 (롤백 기준선)

- [ ] **user_progress 백업**: 아래 명령으로 덤프를 떠서 보관 — 문제가 생겼을 때의 복구 기준선.
  ```sh
  export $(grep -E '^POSTGRES_URL_NON_POOLING=' .env.local | sed 's/"//g')
  pg_dump "$POSTGRES_URL_NON_POOLING" -t user_progress -t user_devices -t user_settings \
    -f backup-user-data-$(date +%Y%m%d).sql
  ```
- [ ] **Vercel 프로덕션 환경변수 확인** (Settings → Environment Variables, Production 스코프):
  - `NEXT_PUBLIC_PROGRESS_READONLY` — **없어야 함** (preview 스코프에만 유지)
  - `CATALOG_SOURCE=supabase`
  - `NEXT_PUBLIC_ANON_SYNC` — 미설정(=기본 활성) 또는 의도한 값
  - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` 존재
- [ ] **백필 dry-run**: `npx tsx --env-file .env.local scripts/backfill-progress.ts --dry-run`
  출력(대상 행 수·변환 내역)을 훑어보고 이상 없으면 실제 실행. 실측치(1,394행)와 크게 어긋나면 중단하고 원인 확인.
- [ ] preview 배포에서 마지막 육안 점검: 메인 목록 / 104기 7~12화 자막 표시 / 공지 배너·/updates

## 2. 배포

- [ ] PR #35 머지 (CodeRabbit 리뷰 코멘트 중 반영할 것 있는지 한 번 훑기)
- [ ] Vercel main 배포 완료 대기 → 빌드 로그에서 에러·경고 확인

## 3. 배포 직후 스모크 테스트 (10분)

- [ ] **비회원 (시크릿 창)**: 메인 로드 → 아무 콘텐츠 체크 → 새로고침 후 유지 확인
- [ ] **기존 회원 (본인 계정)**: 로그인 → 기존 시청 기록 그대로인지 확인 (개수 감소 없어야 함) → 새 체크 1건 → 다른 기기/창에서 동기화 확인
- [ ] **레거시 기록 확장**: 옛날에 통영상으로 본 에피소드(예: 103기 3화)가 파트별로 전부 시청 처리돼 있는지
- [ ] **막간/자막**: 103기 3화 막간 '하로메구 채널!'에 자막으로 보기 / 자막 없이 보기 둘 다 뜨는지
- [ ] **공지**: 메인 배너 표시 → 자세히 보기 → /updates 글 열림 → 배너 X 닫기 → 새로고침 시 다시 안 뜸
- [ ] **백오피스**: 비로그인 /admin → 로그인 리다이렉트 / 관리자 계정 → 공지·카탈로그·요청 메뉴 동작
- [ ] **요청 폼**: 새 콘텐츠 요청 1건 제출 → 백오피스 인박스에 도착
- [ ] DB 헬스: `SELECT count(*) FROM user_progress;` — 배포 전 기준선(1,394+)보다 줄지 않았는지

## 4. 배포 후 며칠간 운영 수칙

- [ ] Supabase 대시보드 **"Clean up anonymous users" 누르지 말 것** — 익명 유저 행 삭제는 시청 데이터 cascade 삭제를 유발 (정리 정책 수립 전 금지)
- [ ] 백오피스에서 **콘텐츠 삭제 자제** — 시청 기록이 달린 행은 소스 교체로 대응 (104-13 사례 참조)
- [ ] 새 콘텐츠 추가 작업 후에는 라벨 정합성 스캔 재실행 (자막본 없는 story의 원본 영상 제목 한글 여부 — 104기 7~12화 오라벨 재발 방지)
- [ ] Vercel 로그에서 `[catalog] supabase 카탈로그 읽기 실패` 폴백 경고 모니터링

## 롤백 절차 (문제 발생 시)

1. Vercel에서 직전 프로덕션 배포로 **Instant Rollback** (코드 차원)
2. 시청 데이터 이상 시: §1 백업 덤프와 현재 상태 diff로 원인 파악 — **복원 전에 반드시 diff 먼저** (덮어쓰기 복원은 새 기록을 지울 수 있음)
3. 카탈로그 이상 시: `data/playlist.initial.json` 기준으로 시드 재실행 (시드는 삭제하지 않으므로 안전)
