# Deep Interview Spec: Seed Design System v3 전역 통합

## Metadata
- Interview ID: seed-v3-integration-001
- Rounds: 4
- Final Ambiguity Score: 14.4%
- Type: brownfield
- Generated: 2026-04-04
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| 차원 | 점수 | 가중치 | 가중합 |
|------|------|--------|--------|
| Goal Clarity | 0.90 | 0.35 | 0.315 |
| Constraint Clarity | 0.80 | 0.25 | 0.200 |
| Success Criteria | 0.85 | 0.25 | 0.213 |
| Context Clarity | 0.85 | 0.15 | 0.128 |
| **Total Clarity** | | | **0.856** |
| **Ambiguity** | | | **14.4%** |

---

## Goal

Seed Design System v3을 oh-my-hasu 프로젝트에 공식 가이드 기준으로 전역 통합한다.
구체적으로: 패키지 설치 → v2→v3 속성/토큰 마이그레이션 → 다크모드 토글 → 주요 컴포넌트 교체.

---

## 현재 상태 (Context)

| 항목 | 현재 | 목표 |
|------|------|------|
| 패키지 | 미설치 (CSS 변수명만 차용) | `@seed-design/css` + `@seed-design/react` 설치 |
| 빌더 플러그인 | 없음 | `@seed-design/webpack-plugin` in next.config.ts |
| 테마 속성 | `data-seed-scale-color="light"` (v2 레거시) | `data-seed` + `data-seed-color-mode="system"` (v3) |
| CSS 토큰 | `--seed-scale-color-*` with hex fallback (v2 레거시 48개) | `--seed-color-fg-*`, `--seed-color-bg-*`, `--seed-color-stroke-*` (v3 시맨틱) |
| 다크모드 | 없음 | 토글 버튼 + 시스템 자동 감지 |
| 컴포넌트 | 전부 커스텀 | Checkbox / Button(filter) / TextField 교체 |

---

## 작업 범위

### Phase 1: 패키지 설치 & 빌더 설정

```bash
npm install @seed-design/css @seed-design/react
npm install --save-dev @seed-design/webpack-plugin
```

`next.config.ts` 수정:
```ts
import { SeedDesignPlugin } from "@seed-design/webpack-plugin";

webpack(config) {
  config.plugins.push(
    new SeedDesignPlugin({ colorMode: "system", injectColorSchemeTag: true })
  );
  return config;
}
```

`layout.tsx`:
```tsx
import "@seed-design/css/base.css"; // 플러그인이 Recipe CSS 자동 주입
// <html> 속성: data-seed data-seed-color-mode="system"
// 기존 data-seed-scale-color 제거
```

### Phase 2: globals.css 토큰 마이그레이션 (v2 → v3)

48개 `--seed-scale-color-*` 토큰을 v3 시맨틱 토큰으로 전환.
주요 매핑 기준:

| v2 (현재) | v3 (목표) | 용도 |
|-----------|-----------|------|
| `--seed-scale-color-gray-900` | `--seed-color-fg-neutral` | 본문 텍스트 |
| `--seed-scale-color-gray-700` | `--seed-color-fg-neutral-muted` | 부가 텍스트 |
| `--seed-scale-color-gray-500` | `--seed-color-fg-neutral-subtle` | 힌트/플레이스홀더 |
| `--seed-scale-color-gray-400` | `--seed-color-fg-disabled` | 비활성/시청완료 취소선 |
| `--seed-scale-color-gray-00` | `--seed-color-bg-layer-default` | 페이지 배경 |
| `--seed-scale-color-gray-50` | `--seed-color-bg-layer-fill` | 카드/영역 배경 |
| `--seed-scale-color-gray-100` | `--seed-color-bg-neutral-weak` | 비활성 버튼/배지 배경 |
| `--seed-scale-color-gray-200` | `--seed-color-stroke-neutral` | 테두리/구분선 |
| `--seed-scale-color-carrot-500` | `--seed-color-bg-brand-solid` (배경) / `--seed-color-fg-brand` (텍스트) | 브랜드 액센트 |
| `--seed-scale-color-carrot-400` | `--seed-color-bg-brand-solid` (hover 시 opacity로 처리) | 버튼 hover |

fallback hex 전부 제거 (v3 패키지가 실제 값 주입).

### Phase 3: 다크모드 토글 구현

- 위치: 헤더 우측 (`page.tsx` 또는 별도 헤더 레이아웃)
- 방식: `document.documentElement.dataset.seedUserColorScheme` 토글
- 초기값: 시스템 설정 따름 (`colorMode: "system"`)
- 상태 지속: `localStorage` 저장 (선택적)

```tsx
// src/components/ThemeToggle.tsx
"use client";
function ThemeToggle() {
  const toggle = () => {
    const html = document.documentElement;
    const current = html.dataset.seedUserColorScheme;
    html.dataset.seedUserColorScheme = current === "dark" ? "light" : "dark";
  };
  return <button onClick={toggle}>☀️ / 🌙</button>;
}
```

### Phase 4: Seed 컴포넌트 교체

교체 대상 (커스텀 CSS 복잡도 낮고 반복되는 것 위주):

| 현재 | Seed 컴포넌트 | 위치 |
|------|---------------|------|
| `<input type="checkbox">` | `<Checkbox.Root>` | `VideoItem.tsx` |
| `<button className="filter-btn">` | `<ActionButton>` 또는 `<ControlChip>` | `FilterBar.tsx` |
| `<input type="text" className="search-input">` | `<TextField.Root>` | `FilterBar.tsx` |

**교체하지 않는 것** (커스텀 레이아웃 복잡하거나 Seed 컴포넌트와 맞지 않음):
- `.season-header` 버튼 (펼침/접힘 chevron 포함)
- `.progress-bar` / `.progress-bar-fill`
- `.video-category-badge`
- 미니 시즌 진행 바

---

## Constraints

- 외부 CSS 라이브러리 추가 없이 Seed만 사용
- `@seed-design/webpack-plugin` 방식으로 설치 (Next.js Webpack 기반)
- React 19 호환 — 공식 확인됨 (devDependencies에서 19.1로 개발 중)
- v2 레거시 패키지(`@seed-design/stylesheet` 등) 사용 금지 — archive 처리됨
- 기존 기능 (토글 API, 필터링 로직, optimistic update) 변경 없음

---

## Non-Goals

- Seed 아이콘 패키지 도입 (현재 inline SVG 유지)
- `@seed-design/react`의 모든 컴포넌트 도입
- Tailwind 연동
- SSR 테마 쿠키 기반 다크모드 (클라이언트 사이드 토글로 충분)

---

## Acceptance Criteria

- [ ] `npm run build` 통과, TypeScript 오류 없음
- [ ] `@seed-design/css`, `@seed-design/react`, `@seed-design/webpack-plugin` 설치됨
- [ ] `layout.tsx`에서 `data-seed-scale-color` 제거, `data-seed` + `data-seed-color-mode="system"` 적용
- [ ] `globals.css`의 모든 `--seed-scale-color-*` 토큰이 v3 시맨틱 토큰으로 대체됨
- [ ] fallback hex 값 전부 제거됨
- [ ] 라이트/다크 토글 버튼이 동작하며 페이지 색상이 전환됨
- [ ] `VideoItem`의 checkbox가 Seed Checkbox 컴포넌트로 교체됨
- [ ] `FilterBar`의 필터 버튼이 Seed ActionButton 또는 ControlChip으로 교체됨
- [ ] `FilterBar`의 검색 input이 Seed TextField로 교체됨
- [ ] 교체되지 않은 커스텀 CSS 영역은 다크모드에서도 색상이 올바르게 전환됨

---

## Assumptions Exposed & Resolved

| 가정 | 질문 | 결정 |
|------|------|------|
| Seed를 어느 수준으로 쓸 것인가 | 토큰만? 컴포넌트까지? | 컴포넌트 일부 교체까지 |
| v2 vs v3 중 어느 버전 기준인가 | 공식 가이드를 따른다면 v3 | v3 (현재 활성 버전) |
| globals.css 토큰 마이그레이션 범위 | 지금 할지 나중에 할지 | 이번에 함께 v3 시맨틱 토큰으로 |
| 다크모드 토글 위치 | 공식 가이드 패턴 따름 | 헤더 우측 (page.tsx 레벨) |

---

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| SeedToken (v3) | core domain | name, cssVar, lightValue, darkValue | 대체 SeedToken (v2) |
| SeedToken (v2) | replaced | name, cssVar, hexFallback | globals.css에서 사용됨 |
| ColorMode | core domain | value(system/light/dark) | html[data-seed-color-mode] |
| ThemeToggle | supporting | currentScheme | ColorMode를 변경 |
| SeedCheckbox | core domain | checked, onChange | VideoItem에서 사용 |
| SeedTextField | core domain | value, onChange, placeholder | FilterBar에서 사용 |
| ActionButton/ControlChip | core domain | variant, onClick, active | FilterBar에서 사용 |
| WebpackPlugin | external system | colorMode, injectColorSchemeTag | next.config.ts에 등록 |
| globals.css | supporting | 48개 토큰 참조 | v3 토큰으로 마이그레이션 대상 |

---

## Interview Transcript

<details>
<summary>전체 Q&A (4 라운드)</summary>

### Round 1
**Q:** Seed Design System을 "전역으로 사용한다"고 할 때, 어느 레벨을 목표로 하고 있나요?
**A:** 다크모드까지 (data-seed-color-mode 속성 기반 라이트/다크 전환)
**Ambiguity:** 80% (Goal: 0.35, Constraints: 0.00, Criteria: 0.00, Context: 0.55)

### Round 2
**Q:** Seed React 컴포넌트(Button, Input 등)는 어떻게 하실 생각인가요?
**A:** 일부 교체 (반복되는 UI를 Seed 컴포넌트로 교체, 복잡한 커스텀 유지)
**Ambiguity:** 68% (Goal: 0.60, Constraints: 0.10, Criteria: 0.00, Context: 0.60)

### Round 3
**Q:** 이 작업이 "완료"됐다고 할 수 있는 가장 중요한 조건은?
**A:** 컴포넌트 교체까지 — Checkbox/Button/TextField 교체 + 다크모드 + 토큰 정리
**Ambiguity:** 42% (Goal: 0.75, Constraints: 0.15, Criteria: 0.70, Context: 0.65)

### Round 4
**Q:** v3 시맨틱 토큰으로 전환하는 것도 포함하나요?
**A:** 토큰까지 v3로 — globals.css 전체 마이그레이션 포함
**Ambiguity:** 14.4% ✅ (Goal: 0.90, Constraints: 0.80, Criteria: 0.85, Context: 0.85)

</details>
