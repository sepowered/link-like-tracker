# oh-my-hasu

하스노소라(蓮ノ空女学院スクールアイドルクラブ) 관련 영상 시청 기록 관리 앱.

> "Link! Like! LoveLive! 활동기록"

---

## 개요

시즌별로 정리된 영상 목록에서 시청 여부를 체크하고, 전체 진행률을 추적하는 개인용 웹 앱입니다.

- **스택:** Next.js 16.2.2 · React 19.2.4 · TypeScript
- **저장소:** 서버 파일시스템의 JSON 파일 (`data/playlist.json`)
- **렌더링:** 초기 데이터는 SSR, 상태 토글은 클라이언트 Optimistic Update

---

## 기능

| 기능 | 설명 |
|------|------|
| 시청 체크 | 영상 옆 체크박스로 시청 완료 토글 (즉시 반영, 실패 시 롤백) |
| 진행률 표시 | 전체 및 시즌별 시청 비율 (%) + 프로그레스 바 |
| 시즌 접기/펼치기 | 시즌 헤더 클릭으로 토글 |
| 시청 필터 | 전체 / 미시청 / 시청 완료 |
| 카테고리 필터 | 전체 분류 / 스토리 / 음악 / With×MEETS |
| 제목 검색 | 텍스트 입력으로 영상 제목 필터링 |
| Private video 숨기기 | `[Private video]` · `[Deleted video]` 항목 숨김 |

### 카테고리 자동 분류

영상 제목 패턴으로 자동 분류됩니다 (`src/lib/video-category.ts`).

- **스토리** — "링크라 활동기록", "Link! Like! LoveLive!", "제X화", "第X話", "Episode X", "X장"
- **음악** — "Lyric Video", "リリックビデオ", "리릭비디오", "FesxLIVE", "오프닝 영상", "Ending Theme", "ED"
- **With×MEETS** — "with×meets" 포함

---

## 프로젝트 구조

```
oh-my-hasu/
├── data/
│   ├── playlist.initial.json   # 초기 플레이리스트 데이터 (read-only 원본)
│   └── playlist.json           # 런타임 데이터 (시청 상태 포함, 없으면 initial에서 복사)
├── src/
│   ├── app/
│   │   ├── page.tsx            # 루트 페이지 (SSR, 초기 데이터 로드)
│   │   ├── layout.tsx          # 앱 레이아웃
│   │   ├── globals.css         # 전역 스타일
│   │   └── api/playlist/
│   │       ├── route.ts        # GET  /api/playlist
│   │       └── [videoId]/route.ts  # PATCH /api/playlist/:videoId
│   ├── components/
│   │   ├── PlaylistView.tsx    # 메인 클라이언트 컴포넌트 (상태 관리)
│   │   ├── FilterBar.tsx       # 필터 · 검색 바
│   │   ├── SeasonGroup.tsx     # 시즌 그룹 (접기/펼치기, 필터 적용)
│   │   └── VideoItem.tsx       # 개별 영상 아이템
│   ├── lib/
│   │   ├── playlist.ts         # storage 인터페이스 export
│   │   ├── playlist.json.ts    # JSON 파일 기반 스토리지 구현
│   │   ├── storage.ts          # IPlaylistStorage 인터페이스 정의
│   │   └── video-category.ts   # 카테고리 분류 로직
│   └── types/
│       └── index.ts            # Video · Season · PlaylistData 타입
└── scripts/                    # 빌드/유틸 스크립트
```

---

## 데이터 구조

```ts
interface PlaylistData {
  seasons: Season[];
}

interface Season {
  id: string;
  name: string;
  videos: Video[];
}

interface Video {
  id: string;      // YouTube 영상 ID 등
  title: string;
  url: string;
  watched: boolean;
}
```

### 스토리지 동작 방식

- 앱 최초 실행 시 `data/playlist.json`이 없으면 `data/playlist.initial.json`을 복사해 생성
- 파일 `mtime` 기반 인메모리 캐시로 불필요한 디스크 읽기 최소화
- `toggleWatched`는 파일 전체를 다시 쓰는 방식으로 상태 영속화

---

## API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/playlist` | 전체 플레이리스트 반환 |
| `PATCH` | `/api/playlist/:videoId` | 해당 영상의 시청 상태 토글, `{ watched: boolean }` 반환 |

`PATCH` 성공 시 `revalidatePath("/")` 호출로 Next.js 캐시 무효화.

---

## 개발 환경

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run start
```

---

## 스타일

- 외부 CSS 라이브러리 없음, `globals.css`에 전부 작성
- 컬러 시스템은 당근마켓 Seed 디자인 토큰 변수 참조 (`--seed-scale-color-carrot-500` 등)
- 반응형: 600px 이하에서 필터 바가 세로 배치로 전환
