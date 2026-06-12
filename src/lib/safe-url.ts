/**
 * URL 스킴 검증 헬퍼 — 클라이언트/서버 양쪽에서 import 가능해야 하므로
 * `server-only`를 두지 않는다.
 *
 * 목적: href에 `javascript:` 같은 위험한 스킴이 들어가 XSS가 되는 것을 막고,
 * 서버 쓰기 경로에서도 http/https 외의 스킴이 저장되지 않게 한다.
 */

/** http: / https: 스킴만 허용. URL 파싱 자체가 실패해도 거부. */
function isHttpUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

/**
 * 렌더링용 안전한 href를 돌려준다.
 * - http/https URL이면 그대로 반환
 * - 그 외(빈 값, javascript:, data:, 상대경로 등)면 null → href를 비워 링크를 비활성화
 */
export function safeHttpHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return isHttpUrl(trimmed) ? trimmed : null;
}

/**
 * 서버측 검증용 — http/https가 아니면 throw 한다.
 * createContentSource / updateContentSource 등 쓰기 직전에 호출해 잘못된 스킴이
 * 영구 저장되는 것을 막는다.
 */
export function assertHttpUrl(raw: string): void {
  if (!isHttpUrl(raw.trim())) {
    throw new Error(`[safe-url] http/https URL이 아닙니다: ${raw}`);
  }
}
