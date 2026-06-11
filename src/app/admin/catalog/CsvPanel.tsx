"use client";

/**
 * CsvPanel — 카탈로그 내보내기/가져오기 패널 (DataPageShell actions 슬롯).
 *
 * 내보내기: exportCatalogCsvAction() → Blob 다운로드 (text/csv;charset=utf-8).
 * 가져오기: 파일 선택 → papaparse 파싱 → 인코딩/헤더 클라이언트 검증 →
 *           previewCatalogImport() → BottomSheet 미리보기 (생성/수정/변경없음/오류) →
 *           "적용" → commitCatalogImport() → Snackbar → router.refresh().
 */

import * as React from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import {
  BottomSheetRoot,
  BottomSheetTrigger,
  BottomSheetContent,
  BottomSheetBody,
  BottomSheetFooter,
} from "@/ui/bottom-sheet";
import { ActionButton } from "@/ui/action-button";
import { Snackbar, useSnackbarAdapter } from "@/ui/snackbar";
import { exportCatalogCsvAction } from "@/app/admin/actions/catalog-export";
import {
  previewCatalogImport,
  commitCatalogImport,
} from "@/app/admin/actions/catalog-import";
import { toCsvRow } from "@/lib/admin/csv-contract";
import { validateHeader, detectEncodingIssue } from "@/lib/admin/csv-validate";
import type { ImportPreview } from "@/lib/admin/csv-validate";
import type { ImportPayload } from "@/lib/admin/csv-contract";

////////////////////////////////////////////////////////////////////////////////////
// Design tokens

const T = {
  monoFamily: "'Geist Mono', 'SF Mono', ui-monospace, monospace",
  rowMinH: "34px",
} as const;

////////////////////////////////////////////////////////////////////////////////////
// Snackbar helpers

function useSuccessSnackbar() {
  const adapter = useSnackbarAdapter();
  return React.useCallback(
    (msg: string) => {
      adapter.create({ render: () => <Snackbar variant="positive" message={msg} /> });
    },
    [adapter],
  );
}

function useErrorSnackbar() {
  const adapter = useSnackbarAdapter();
  return React.useCallback(
    (msg: string) => {
      adapter.create({ render: () => <Snackbar variant="critical" message={msg} /> });
    },
    [adapter],
  );
}

////////////////////////////////////////////////////////////////////////////////////
// CountBadge — "생성 N" 같은 인라인 배지

function CountBadge({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: "positive" | "informative" | "neutral" | "critical";
}) {
  const colors: Record<typeof variant, { bg: string; fg: string }> = {
    positive:    { bg: "var(--seed-color-bg-positive-weak)",    fg: "var(--seed-color-fg-positive)" },
    informative: { bg: "var(--seed-color-bg-informative-weak)", fg: "var(--seed-color-fg-informative)" },
    neutral:     { bg: "var(--seed-color-bg-neutral-weak)",     fg: "var(--seed-color-fg-neutral-subtle)" },
    critical:    { bg: "var(--seed-color-bg-critical-weak)",    fg: "var(--seed-color-fg-critical)" },
  };
  const c = colors[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 8px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: 600,
        backgroundColor: c.bg,
        color: c.fg,
        whiteSpace: "nowrap",
      }}
    >
      {label} <span style={{ fontFamily: T.monoFamily }}>{count}</span>
    </span>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// ErrorTable — 오류 행 테이블

function ErrorTable({ errors }: { errors: ImportPreview["errors"] }) {
  if (errors.length === 0) return null;
  return (
    <div style={{ overflowX: "auto", marginTop: "12px" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "12px",
          color: "var(--seed-color-fg-neutral)",
          tableLayout: "fixed",
        }}
      >
        <colgroup>
          <col style={{ width: "56px" }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th
              style={{
                padding: "0 8px",
                height: "28px",
                textAlign: "left",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--seed-color-fg-neutral-subtle)",
                backgroundColor: "var(--seed-color-bg-neutral-weak)",
                borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)",
                whiteSpace: "nowrap",
              }}
            >
              행
            </th>
            <th
              style={{
                padding: "0 8px",
                height: "28px",
                textAlign: "left",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--seed-color-fg-neutral-subtle)",
                backgroundColor: "var(--seed-color-bg-neutral-weak)",
                borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)",
              }}
            >
              사유
            </th>
          </tr>
        </thead>
        <tbody>
          {errors.map((e, i) => (
            <tr
              key={i}
              style={{ borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)" }}
            >
              <td
                style={{
                  padding: "0 8px",
                  height: T.rowMinH,
                  verticalAlign: "middle",
                  fontFamily: T.monoFamily,
                  fontSize: "11px",
                  color: "var(--seed-color-fg-critical)",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {e.row}
              </td>
              <td
                style={{
                  padding: "0 8px",
                  height: T.rowMinH,
                  verticalAlign: "middle",
                  color: "var(--seed-color-fg-neutral)",
                  wordBreak: "break-all",
                }}
              >
                {e.reason}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// PreviewSheet — 미리보기 바텀시트 (트리거 없이 open prop으로 제어)

interface PreviewSheetProps {
  open: boolean;
  onClose: () => void;
  preview: ImportPreview | null;
  committing: boolean;
  onCommit: () => void;
}

function PreviewSheet({ open, onClose, preview, committing, onCommit }: PreviewSheetProps) {
  const hasErrors = (preview?.errors.length ?? 0) > 0;
  const canCommit = !hasErrors && preview?.payload != null && !committing;

  const totalCreated = (preview?.createdContents ?? 0) + (preview?.createdSources ?? 0);
  const totalUpdated = (preview?.updatedContents ?? 0) + (preview?.updatedSources ?? 0);
  const totalUnchanged = (preview?.unchangedContents ?? 0) + (preview?.unchangedSources ?? 0);

  return (
    <BottomSheetRoot open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* 트리거 없음 — open prop으로만 제어 */}
      <BottomSheetTrigger asChild>
        <span style={{ display: "none" }} />
      </BottomSheetTrigger>
      <BottomSheetContent title="가져오기 미리보기" showHandle>
        <BottomSheetBody>
          {preview == null ? (
            <p style={{ fontSize: "13px", color: "var(--seed-color-fg-neutral-subtle)", padding: "8px 0" }}>
              검증 중…
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0" }}>
              {/* 카운트 요약 */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <CountBadge label="생성" count={totalCreated} variant="positive" />
                <CountBadge label="수정" count={totalUpdated} variant="informative" />
                <CountBadge label="변경없음" count={totalUnchanged} variant="neutral" />
                {hasErrors && (
                  <CountBadge label="오류" count={preview.errors.length} variant="critical" />
                )}
              </div>

              {/* 상세 카운트 */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "4px 16px",
                  fontSize: "12px",
                  color: "var(--seed-color-fg-neutral-subtle)",
                }}
              >
                <span>콘텐츠 생성</span>
                <span style={{ fontFamily: T.monoFamily, fontWeight: 600, color: "var(--seed-color-fg-neutral)" }}>{preview.createdContents}</span>
                <span>콘텐츠 수정</span>
                <span style={{ fontFamily: T.monoFamily, fontWeight: 600, color: "var(--seed-color-fg-neutral)" }}>{preview.updatedContents}</span>
                <span>콘텐츠 변경없음</span>
                <span style={{ fontFamily: T.monoFamily, fontWeight: 600, color: "var(--seed-color-fg-neutral)" }}>{preview.unchangedContents}</span>
                <span>소스 생성</span>
                <span style={{ fontFamily: T.monoFamily, fontWeight: 600, color: "var(--seed-color-fg-neutral)" }}>{preview.createdSources}</span>
                <span>소스 수정</span>
                <span style={{ fontFamily: T.monoFamily, fontWeight: 600, color: "var(--seed-color-fg-neutral)" }}>{preview.updatedSources}</span>
                <span>소스 변경없음</span>
                <span style={{ fontFamily: T.monoFamily, fontWeight: 600, color: "var(--seed-color-fg-neutral)" }}>{preview.unchangedSources}</span>
              </div>

              {/* 오류 테이블 */}
              {hasErrors && (
                <div>
                  <p
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--seed-color-fg-critical)",
                      margin: "0 0 4px",
                    }}
                  >
                    차단 오류 — 아래 오류를 수정한 뒤 다시 가져오세요.
                  </p>
                  <ErrorTable errors={preview.errors} />
                </div>
              )}
            </div>
          )}
        </BottomSheetBody>
        <BottomSheetFooter>
          <div style={{ display: "flex", gap: "8px", width: "100%" }}>
            <ActionButton
              variant="neutralOutline"
              size="medium"
              style={{ flex: 1 }}
              onClick={onClose}
              disabled={committing}
            >
              취소
            </ActionButton>
            <ActionButton
              variant="brandSolid"
              size="medium"
              style={{ flex: 1 }}
              disabled={!canCommit}
              loading={committing}
              onClick={onCommit}
            >
              적용
            </ActionButton>
          </div>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheetRoot>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// CsvPanel

export function CsvPanel() {
  const router = useRouter();
  const showSuccess = useSuccessSnackbar();
  const showError = useErrorSnackbar();

  // 내보내기
  const [exporting, setExporting] = React.useState(false);

  // 가져오기
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewing, setPreviewing] = React.useState(false);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [pendingPayload, setPendingPayload] = React.useState<ImportPayload | null>(null);
  const [committing, setCommitting] = React.useState(false);

  // ── 내보내기 ──────────────────────────────────────────────────────────────

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const csvText = await exportCatalogCsvAction();
      // BOM은 서버가 이미 붙여서 반환. UTF-8로 Blob 생성.
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      a.href = url;
      a.download = `catalog-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showError("내보내기에 실패했어요. 다시 시도해 주세요.");
      console.error("[CsvPanel] export error", err);
    } finally {
      setExporting(false);
    }
  }

  // ── 가져오기: 파일 선택 → 파싱 → 검증 → 미리보기 ─────────────────────────

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // 다음 선택을 위해 초기화 (같은 파일 재선택 허용)
    e.target.value = "";
    if (!file) return;

    setPreviewing(true);
    setPreview(null);
    setPendingPayload(null);

    try {
      const rawText = await file.text();

      // 인코딩 감지
      const encodingErr = detectEncodingIssue(rawText);
      if (encodingErr) {
        showError(encodingErr);
        return;
      }

      // papaparse (header:true)
      const parsed = Papa.parse<Record<string, unknown>>(rawText, {
        header: true,
        skipEmptyLines: true,
      });

      // 헤더 검증
      const headerErr = validateHeader(parsed.meta.fields ?? []);
      if (headerErr) {
        showError(headerErr);
        return;
      }

      // 행을 CsvRow로 정규화
      const rows = parsed.data.map(toCsvRow);

      if (rows.length === 0) {
        showError("CSV에 데이터 행이 없습니다.");
        return;
      }

      // 미리보기 시트 열기 (서버 검증 중 표시)
      setPreviewOpen(true);

      // 서버 액션 호출
      const result = await previewCatalogImport(rows);
      setPreview(result);
      setPendingPayload(result.payload);
    } catch (err) {
      showError("파일을 읽는 중 오류가 발생했어요. 다시 시도해 주세요.");
      console.error("[CsvPanel] import parse error", err);
      setPreviewOpen(false);
    } finally {
      setPreviewing(false);
    }
  }

  // ── 커밋 ──────────────────────────────────────────────────────────────────

  async function handleCommit() {
    if (!pendingPayload || committing) return;
    setCommitting(true);
    try {
      const result = await commitCatalogImport(pendingPayload);
      if (result.ok) {
        const s = result.summary;
        const msg = s
          ? `가져오기 완료 — 콘텐츠 +${s.created_contents}/~${s.updated_contents}, 소스 +${s.created_sources}/~${s.updated_sources}`
          : "가져오기 완료";
        showSuccess(msg);
        setPreviewOpen(false);
        router.refresh();
      } else {
        showError(result.error ?? "가져오기에 실패했어요. 전체 롤백됐습니다.");
        setPreviewOpen(false);
      }
    } catch (err) {
      showError("가져오기 중 예상치 못한 오류가 발생했어요.");
      console.error("[CsvPanel] commit error", err);
      setPreviewOpen(false);
    } finally {
      setCommitting(false);
    }
  }

  function handlePreviewClose() {
    if (committing) return;
    setPreviewOpen(false);
    setPreview(null);
    setPendingPayload(null);
  }

  // ── 렌더 ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* 내보내기 버튼 */}
      <ActionButton
        variant="neutralOutline"
        size="small"
        loading={exporting}
        disabled={exporting}
        onClick={handleExport}
        aria-label="카탈로그 CSV 내보내기"
      >
        내보내기
      </ActionButton>

      {/* 가져오기 버튼 */}
      <ActionButton
        variant="neutralWeak"
        size="small"
        loading={previewing}
        disabled={previewing || previewOpen}
        onClick={handleImportClick}
        aria-label="카탈로그 CSV 가져오기"
      >
        가져오기
      </ActionButton>

      {/* 미리보기 시트 */}
      <PreviewSheet
        open={previewOpen}
        onClose={handlePreviewClose}
        preview={preview}
        committing={committing}
        onCommit={handleCommit}
      />
    </>
  );
}
