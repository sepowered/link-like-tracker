"use client";

/**
 * EditableCell — DataTable `cell` 렌더러 안에서 쓰는 자족적 인라인 편집 셀.
 *
 * DataTable 코어는 편집을 모른다(원칙 2). 편집 상태/포커스/커밋은 전부 여기서.
 * rdg에는 편집 행을 들고 있는 상태머신이 있었지만 headless에는 없으므로, 아래
 * 계약을 직접 구현한다:
 *
 *   (a) 마운트 시드 + 편집 중 로컬 신뢰: 편집 진입 시 표시값을 로컬 state로 시드하고,
 *       편집 중에는 로컬만 신뢰한다(부모 prop이 낙관적 재렌더로 바뀌어도 타이핑을 안 날림).
 *       비활성(표시) 상태에서만 부모값으로 재시드 → 서버 롤백/외부 변경 반영.
 *   (b) committedRef 단일 커밋 가드: blur+Enter 이중 발화와 React 19 Strict-Mode 중복을 막음.
 *   (c) 활성 에디터는 소비처에서 `key={`${row.id}:${field}`}`로 키잉(셀 단위 안정 키).
 *   (d) Escape 취소는 커밋 가드를 세팅한 채 닫아 blur가 또 커밋하지 않게 한다.
 *
 * onCommit은 "바뀐 값"만 알린다. 어느 필드인지·patch·null 변환·도메인 가드·낙관/롤백은
 * 소비처(표면)가 소유한다 — 보통 컬럼 정의에서 onCommit을 (v) => surfaceCommit(field, v)로 감싼다.
 */

import * as React from "react";

const MONO = "'Geist Mono', 'SF Mono', ui-monospace, monospace";

// 표시/입력 모두 동일한 12px 가로 인셋 → 비편집 셀과 정렬 일치.
// (이 셀의 컬럼은 meta.noPadding=true 로 두어 td 패딩을 0으로 만든다.)
const box: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0 12px",
  boxSizing: "border-box",
  lineHeight: "34px", // 단일행 세로 중앙 정렬 (DataTable 행 높이와 일치). 박스는 content-height,
  overflow: "hidden", // td의 verticalAlign:middle 이 박스를 세로 가운데로 둔다.
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const inputBox: React.CSSProperties = {
  ...box,
  height: "100%", // 편집 입력은 셀을 세로로 꽉 채운다(입력 자체가 텍스트를 가운데 정렬).
  border: "none",
  outline: "none",
  backgroundColor: "var(--seed-color-bg-layer-default)",
  color: "var(--seed-color-fg-neutral)",
  fontSize: "13px",
};

// ── 텍스트 ──────────────────────────────────────────────────────────────────
export function EditableTextCell({
  value,
  onCommit,
  ariaLabel,
  mono,
  placeholder = "—",
}: {
  value: string | null;
  onCommit: (next: string) => void;
  ariaLabel?: string;
  mono?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");
  const committedRef = React.useRef(false);

  // (a) 비활성 상태에서만 부모값으로 재시드. 편집 중엔 로컬만 신뢰.
  React.useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  function enter() {
    committedRef.current = false;
    setDraft(value ?? "");
    setEditing(true);
  }
  function commit() {
    if (committedRef.current) return; // (b) 단일 커밋
    committedRef.current = true;
    setEditing(false);
    if ((draft ?? "") !== (value ?? "")) onCommit(draft);
  }
  function cancel() {
    committedRef.current = true; // (d) blur가 또 커밋하지 않게
    setEditing(false);
    setDraft(value ?? "");
  }

  if (!editing) {
    return (
      <span
        tabIndex={0}
        role="button"
        aria-label={ariaLabel}
        onClick={(e) => { e.stopPropagation(); enter(); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); enter(); } }}
        style={{ ...box, cursor: "text", fontFamily: mono ? MONO : undefined }}
      >
        {value ?? placeholder}
      </span>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commit();
        else if (e.key === "Escape") cancel();
      }}
      style={{ ...inputBox, fontFamily: mono ? MONO : undefined }}
    />
  );
}

// ── 셀렉트 ──────────────────────────────────────────────────────────────────
export function EditableSelectCell({
  value,
  options,
  onCommit,
  ariaLabel,
  renderDisplay,
}: {
  /** null 은 빈 옵션("")으로 매핑된다(예: category_override "없음(auto)"). */
  value: string | null;
  options: Array<{ value: string; label: string }>;
  onCommit: (next: string) => void;
  ariaLabel?: string;
  /** 비편집 표시를 커스텀(예: 타입 색 배지). 없으면 옵션 라벨 텍스트. */
  renderDisplay?: (value: string) => React.ReactNode;
}) {
  const [editing, setEditing] = React.useState(false);
  const committedRef = React.useRef(false);
  const current = value ?? ""; // (MUST-FIX 6) null → ""
  const label = options.find((o) => o.value === current)?.label ?? (current || "—");

  function enter() {
    committedRef.current = false;
    setEditing(true);
  }
  function commit(next: string) {
    if (committedRef.current) return; // (b) 단일 커밋
    committedRef.current = true;
    setEditing(false);
    if (next !== current) onCommit(next);
  }

  if (!editing) {
    return (
      <span
        tabIndex={0}
        role="button"
        aria-label={ariaLabel}
        onClick={(e) => { e.stopPropagation(); enter(); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); enter(); } }}
        style={{ ...box, cursor: "pointer" }}
      >
        {renderDisplay ? renderDisplay(current) : label}
      </span>
    );
  }
  return (
    <select
      autoFocus
      defaultValue={current}
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => commit(e.target.value)} // select는 선택=확정
      onBlur={(e) => commit(e.target.value)} // 안전망
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") { committedRef.current = true; setEditing(false); }
      }}
      style={{ ...inputBox, cursor: "pointer" }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
