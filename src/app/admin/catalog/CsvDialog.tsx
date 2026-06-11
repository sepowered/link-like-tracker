"use client";

/**
 * CsvDialog — 카탈로그 CSV 내보내기/가져오기 Dialog.
 *
 * 내보내기: exportCatalogCsvAction() → Blob 다운로드 (catalog-YYYY-MM-DD.csv).
 * 가져오기: 파일 선택 → papaparse + detectEncodingIssue + validateHeader + toCsvRow →
 *           previewCatalogImport(rows) → 미리보기(카운트 + 오류 최대 10건) →
 *           오류 0이면 "적용" → commitCatalogImport(payload) → 토스트 + onImported().
 *
 * 스타일: 전부 .adm-* 클래스. 기존 CsvPanel.tsx의 파일 처리 로직을 참고해 v2로 재작성.
 */

import * as React from "react";
import Papa from "papaparse";
import { Dialog, useToast } from "@/app/admin/ui/primitives";
import { exportCatalogCsvAction } from "@/app/admin/actions/catalog-export";
import { previewCatalogImport, commitCatalogImport } from "@/app/admin/actions/catalog-import";
import { toCsvRow } from "@/lib/admin/csv-contract";
import { validateHeader, detectEncodingIssue } from "@/lib/admin/csv-validate";
import type { ImportPreview } from "@/lib/admin/csv-validate";
import type { ImportPayload } from "@/lib/admin/csv-contract";

// ── 내보내기 Dialog ──────────────────────────────────────────────────────

function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast, toastError } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function handleExport() {
    if (busy) return;
    setBusy(true);
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
      toast("CSV를 내려받았어요.");
      onClose();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "내보내기에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="CSV 내보내기"
      footer={
        <>
          <button type="button" className="adm-btn" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            onClick={handleExport}
            disabled={busy}
          >
            {busy ? <span className="adm-spin" /> : null}
            내려받기
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: "var(--adm-fg-muted)", fontSize: "var(--adm-fs-md)", lineHeight: 1.6 }}>
        전체 카탈로그를 UTF-8 BOM CSV로 내보냅니다.<br />
        파일명: <span className="adm-mono">catalog-{new Date().toISOString().slice(0, 10)}.csv</span>
      </p>
    </Dialog>
  );
}

// ── 가져오기 Dialog ──────────────────────────────────────────────────────

function ImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const { toast, toastError } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 단계: idle → previewing → previewed → committing → done
  const [stage, setStage] = React.useState<"idle" | "previewing" | "previewed" | "committing">("idle");
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [pendingPayload, setPendingPayload] = React.useState<ImportPayload | null>(null);

  // Dialog 닫힐 때 상태 초기화
  React.useEffect(() => {
    if (!open) {
      setStage("idle");
      setPreview(null);
      setPendingPayload(null);
    }
  }, [open]);

  // ── 파일 선택 → 파싱 → 서버 미리보기 ──
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // 같은 파일 재선택을 위해 초기화
    e.target.value = "";
    if (!file) return;

    setStage("previewing");
    setPreview(null);
    setPendingPayload(null);

    try {
      const rawText = await file.text();

      // 인코딩 감지 (모지바케)
      const encodingErr = detectEncodingIssue(rawText);
      if (encodingErr) {
        toastError(encodingErr);
        setStage("idle");
        return;
      }

      // papaparse (header:true, BOM 자동 처리)
      const parsed = Papa.parse<Record<string, unknown>>(rawText, {
        header: true,
        skipEmptyLines: true,
      });

      // 헤더 검증
      const headerErr = validateHeader(parsed.meta.fields ?? []);
      if (headerErr) {
        toastError(headerErr);
        setStage("idle");
        return;
      }

      // 행을 CsvRow로 정규화
      const rows = parsed.data.map(toCsvRow);
      if (rows.length === 0) {
        toastError("CSV에 데이터 행이 없어요.");
        setStage("idle");
        return;
      }

      // 서버에서 미리보기 (DB 대조 포함)
      const result = await previewCatalogImport(rows);
      setPreview(result);
      setPendingPayload(result.payload);
      setStage("previewed");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "파일을 읽는 중 오류가 발생했어요.");
      setStage("idle");
    }
  }

  // ── 커밋 ──
  async function handleCommit() {
    if (!pendingPayload || stage === "committing") return;
    setStage("committing");
    try {
      const result = await commitCatalogImport(pendingPayload);
      if (result.ok) {
        const s = result.summary;
        const msg = s
          ? `가져오기 완료 — 콘텐츠 +${s.created_contents}/~${s.updated_contents}, 소스 +${s.created_sources}/~${s.updated_sources}`
          : "가져오기 완료";
        toast(msg);
        onClose();
        onImported();
      } else {
        toastError(result.error ?? "가져오기에 실패했어요. 전체 롤백됐습니다.");
        setStage("previewed");
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : "가져오기 중 예상치 못한 오류가 발생했어요.");
      setStage("previewed");
    }
  }

  const isBusy = stage === "previewing" || stage === "committing";
  const hasErrors = (preview?.errors.length ?? 0) > 0;
  const canCommit = stage === "previewed" && !hasErrors && pendingPayload !== null;

  return (
    <Dialog
      open={open}
      onClose={isBusy ? () => {} : onClose}
      title="CSV 가져오기"
      wide
      footer={
        stage === "previewed" ? (
          <>
            <button type="button" className="adm-btn" onClick={onClose} disabled={isBusy}>
              취소
            </button>
            <button
              type="button"
              className="adm-btn adm-btn--primary"
              onClick={handleCommit}
              disabled={!canCommit || isBusy}
            >
              {isBusy ? <span className="adm-spin" /> : null}
              적용
            </button>
          </>
        ) : (
          <button type="button" className="adm-btn" onClick={onClose} disabled={isBusy}>
            닫기
          </button>
        )
      }
    >
      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* idle: 파일 선택 안내 */}
      {stage === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--adm-sp-3)" }}>
          <p style={{ margin: 0, color: "var(--adm-fg-muted)", fontSize: "var(--adm-fs-md)", lineHeight: 1.6 }}>
            내보낸 CSV 파일을 선택하면 검증 후 미리보기를 표시해요.<br />
            오류가 없을 때만 &quot;적용&quot;이 활성화됩니다.
          </p>
          <div>
            <button
              type="button"
              className="adm-btn adm-btn--primary"
              onClick={() => fileInputRef.current?.click()}
            >
              파일 선택
            </button>
          </div>
        </div>
      )}

      {/* previewing: 검증 중 */}
      {stage === "previewing" && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--adm-sp-3)", padding: "var(--adm-sp-4) 0" }}>
          <span className="adm-spin" />
          <span className="adm-muted">검증 중…</span>
        </div>
      )}

      {/* previewed: 미리보기 결과 */}
      {(stage === "previewed" || stage === "committing") && preview && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--adm-sp-4)" }}>
          {/* 카운트 요약 배지 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--adm-sp-2)" }}>
            <SummaryBadge label="콘텐츠 생성" count={preview.createdContents} tone="positive" />
            <SummaryBadge label="콘텐츠 수정" count={preview.updatedContents} tone="info" />
            <SummaryBadge label="콘텐츠 변경없음" count={preview.unchangedContents} tone="neutral" />
            <SummaryBadge label="소스 생성" count={preview.createdSources} tone="positive" />
            <SummaryBadge label="소스 수정" count={preview.updatedSources} tone="info" />
            <SummaryBadge label="소스 변경없음" count={preview.unchangedSources} tone="neutral" />
            {hasErrors && (
              <SummaryBadge label="오류" count={preview.errors.length} tone="danger" />
            )}
          </div>

          {/* 오류 목록 (최대 10건) */}
          {hasErrors && (
            <div>
              <p style={{ margin: "0 0 var(--adm-sp-2)", fontSize: "var(--adm-fs-xs)", fontWeight: 700, color: "var(--adm-danger)" }}>
                차단 오류 — 아래 오류를 수정한 뒤 다시 가져오세요.
              </p>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 56 }}>행</th>
                      <th>사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errors.slice(0, 10).map((err, i) => (
                      <tr key={i}>
                        <td className="adm-cell-mono" style={{ color: "var(--adm-danger)" }}>{err.row}</td>
                        <td style={{ whiteSpace: "normal", wordBreak: "break-all" }}>{err.reason}</td>
                      </tr>
                    ))}
                    {preview.errors.length > 10 && (
                      <tr>
                        <td colSpan={2} className="adm-muted" style={{ fontSize: "var(--adm-fs-xs)", textAlign: "center" }}>
                          …외 {preview.errors.length - 10}건 더
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* 오류 있을 때 다시 파일 선택 */}
              <div style={{ marginTop: "var(--adm-sp-3)" }}>
                <button
                  type="button"
                  className="adm-btn"
                  onClick={() => { setStage("idle"); setPreview(null); setPendingPayload(null); }}
                >
                  다른 파일 선택
                </button>
              </div>
            </div>
          )}

          {/* 오류 없음 안내 */}
          {!hasErrors && (
            <p style={{ margin: 0, color: "var(--adm-fg-muted)", fontSize: "var(--adm-fs-sm)" }}>
              오류가 없어요. &quot;적용&quot;을 누르면 카탈로그에 반영됩니다(원자적, 실패 시 전체 롤백).
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

// ── 요약 배지 ────────────────────────────────────────────────────────────

function SummaryBadge({ label, count, tone }: { label: string; count: number; tone: "positive" | "info" | "neutral" | "danger" }) {
  const styles: Record<typeof tone, { background: string; color: string }> = {
    positive: { background: "var(--seed-color-bg-positive-weak)", color: "var(--seed-color-fg-positive)" },
    info:     { background: "var(--seed-color-bg-informative-weak)", color: "var(--seed-color-fg-informative)" },
    neutral:  { background: "var(--adm-bg-raised)", color: "var(--adm-fg-muted)" },
    danger:   { background: "var(--adm-danger-bg)", color: "var(--adm-danger)" },
  };
  const s = styles[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 22,
        padding: "0 8px",
        borderRadius: 999,
        fontSize: "var(--adm-fs-xs)",
        fontWeight: 700,
        background: s.background,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
      <span className="adm-mono">{count}</span>
    </span>
  );
}

// ── CsvDialog 진입점 ─────────────────────────────────────────────────────

interface CsvDialogProps {
  mode: "export" | "import";
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

export default function CsvDialog({ mode, open, onClose, onImported }: CsvDialogProps) {
  if (mode === "export") {
    return <ExportDialog open={open} onClose={onClose} />;
  }
  return (
    <ImportDialog
      open={open}
      onClose={onClose}
      onImported={onImported ?? (() => {})}
    />
  );
}
