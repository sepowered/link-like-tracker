"use client";

/**
 * 백오피스 v2 공용 프리미티브.
 *
 * 스타일은 전부 admin.css의 .adm-* 클래스가 담당하고, 여기에는
 * '동작'이 필요한 최소한의 컴포넌트만 둔다 — 다이얼로그(ESC/배경 클릭),
 * 토스트(컨텍스트), 확인 다이얼로그, 상태 배지 매핑.
 */

import * as React from "react";
import {
  REQUEST_STATUS_LABELS,
  type RequestStatus,
} from "@/lib/admin/request-status";

// ── 토스트 ───────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  tone: "default" | "error";
}

interface ToastContextValue {
  toast: (message: string) => void;
  toastError: (message: string) => void;
}

const ToastContext = React.createContext<ToastContextValue>({
  toast: () => {},
  toastError: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);

  const push = React.useCallback((message: string, tone: Toast["tone"]) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, tone === "error" ? 5000 : 2600);
  }, []);

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast: (m) => push(m, "default"),
      toastError: (m) => push(m, "error"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="adm-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`adm-toast${t.tone === "error" ? " adm-toast--error" : ""}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── 다이얼로그 ──────────────────────────────────────────────────────────

export function Dialog({
  open,
  onClose,
  title,
  wide,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="adm-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`adm-dialog${wide ? " adm-dialog--wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="adm-dialog-head">
          <h2 className="adm-dialog-title">{title}</h2>
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="adm-dialog-body">{children}</div>
        {footer && <div className="adm-dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ── 확인 다이얼로그 ─────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "삭제",
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="adm-btn" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button type="button" className="adm-btn adm-btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? <span className="adm-spin" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ fontSize: "var(--adm-fs-md)", lineHeight: 1.6 }}>{description}</div>
    </Dialog>
  );
}

// ── 요청 상태 배지 ──────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string | null }) {
  const valid: RequestStatus[] = ["pending", "approved", "rejected", "done"];
  const s = valid.includes(status as RequestStatus) ? (status as RequestStatus) : null;
  if (!s) return <span className="adm-badge">{status ?? "—"}</span>;
  return <span className={`adm-badge adm-badge--${s}`}>{REQUEST_STATUS_LABELS[s]}</span>;
}

// ── 빈 상태 ─────────────────────────────────────────────────────────────

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="adm-empty">
      <strong>{title}</strong>
      {hint && <span>{hint}</span>}
    </div>
  );
}
