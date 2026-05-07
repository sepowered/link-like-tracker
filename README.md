# 🪷 link-like-tracker

러브라이브! 하스노소라 여학원 스쿨 아이돌 클럽(蓮ノ空女学院スクールアイドルクラブ) 관련 영상 시청 기록을 관리하는 웹 애플리케이션

> 현재 기능 개발이 활발히 진행 중이라 적극적인 Pull Request 반영이 어렵습니다. 버그는 **Issue**, 의견은 **Discussion**을 활용해 주세요.

---

## About this App

- **시청 기록 동기화:** 로컬 환경에서는 파일 시스템(`json`)을, 배포 환경에서는 `localStorage`를 활용하여 시청 상태를 관리합니다.
- **다양한 필터링:** 시청 여부, 카테고리(스토리, 음악, FesxLIVE 등), 검색어 기반 필터링을 지원합니다.
- **기수별 관리:** 하스노소라 여학원 기수별로 영상을 모아볼 수 있습니다.
- **진행률 추적:** 카테고리별 맞춤 진행률 바를 통해 시청 현황을 시각적으로 파악합니다.
- **반응형 디자인:** [@daangn](https://github.com/daangn)의 [**Seed Design System**](https://github.com/daangn/seed-design)을 전역에서 사용 및 가이드라인을 적극 준수합니다.
- **요청 시스템:** 누락된 콘텐츠 추가나 정보 수정을 **Supabase PostgresDB** 연동을 통해 요청할 수 있습니다.

---

## Tech Stack

- **Framework:** [Next.js 16.2 (App Router)](https://nextjs.org/)
- **UI & Interaction:** [React 19](https://reactjs.org/), [Radix UI](https://www.radix-ui.com/), [Seed Design System](https://seed-design.io/)
- **Database (Requests):** [Supabase](https://supabase.com/)
- **Styling:** Vanilla CSS (CSS Variables)
- **Deployment:** [Vercel](https://vercel.com/)

---

## Project Structure

```text
link-like-tracker/
├── data/                       # 플레이리스트 데이터 (JSON)
├── src/
│   ├── app/                    # Next.js App Router (Page, Layout, Server Actions)
│   │   ├── actions/            # Supabase 연동 Server Actions
│   │   ├── add-request/        # 콘텐츠 추가 요청 페이지
│   │   ├── edit-request/       # 정보 수정 요청 페이지
│   │   ├── settings/           # 사용자 설정 페이지
│   │   └── api/                # API Routes (로컬 스토리지 호환용)
│   ├── components/             # React 공통 컴포넌트
│   │   ├── PlaylistView.tsx    # 메인 시청 목록 뷰 (핵심 로직)
│   │   ├── SettingsProvider.tsx # 전역 설정 컨텍스트
│   │   └── VideoItem.tsx       # 개별 영상 항목 및 인터랙션
│   ├── lib/                    # 유틸리티 및 데이터 관리 로직
│   │   ├── supabase.ts         # Supabase 클라이언트 설정
│   │   ├── video-category.ts   # 영상 자동 분류 로직
│   │   └── playlist.json.ts    # JSON 기반 데이터 입출력
│   ├── ui/                     # 디자인 시스템 기반 커스텀 UI 컴포넌트
│   └── types/                  # TypeScript 공통 타입 정의
```

---

## Features

### 1. 영상 목록 및 시청 관리
- **시청 토글:** 영상 항목의 체크박스를 통해 시청 여부를 기록합니다.
- **카테고리 자동 분류:** 제목 패턴을 분석하여 `스토리`, `음악`, `FesxLIVE`, `With×MEETS` 등으로 자동 분류합니다.
- **커스텀 분류:** 자동 분류가 틀린 경우 사용자가 직접 카테고리를 교정할 수 있습니다.

### 2. 필터 및 검색
- **멀티 카테고리 필터:** 여러 카테고리를 동시에 선택하여 필터링할 수 있습니다.
- **시청 필터:** '전체', '미시청', '시청 완료' 영상을 구분해서 볼 수 있습니다.
- **검색:** 제목 내 키워드 검색을 지원합니다.
- **Private 영상 숨기기:** 비공개 또는 삭제된 영상을 목록에서 제외할 수 있습니다.

### 3. 사용자 설정
- **다크 모드 지원:** 시스템 설정 또는 수동 설정을 통한 테마 전환이 가능합니다.
- **진행률 계산 카테고리 설정:** 특정 카테고리(예: 음악 제외 스토리만)를 기준으로 전체 진행률을 계산하도록 설정할 수 있습니다.

### 4. 요청 및 피드백 (Supabase 연동)
- 콘텐츠 추가 및 정보 수정 요청을 서버로 전달합니다.
- Vercel-Supabase Integration을 통하여 데이터를 처리합니다.

---

## Local Development

```bash
# 의존성 설치
npm install

# 환경 변수 설정 (.env.local 생성)
# NEXT_PUBLIC_SUPABASE_URL="..."
# SUPABASE_ANON_KEY="..."

# 개발 서버 실행
npm run dev
```

---
