"use client";

function normalizeOrigin(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

export function getAuthCallbackUrl() {
  const configuredOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);

  const browserOrigin =
    typeof window === "undefined" ? null : normalizeOrigin(window.location.origin);

  // A Vercel preview deployment is a production build (NODE_ENV=production) but
  // is served from its own origin, NOT the configured canonical one. If we
  // forced `configuredOrigin` there, OAuth would bounce back to production after
  // login. So: in dev, or whenever the live browser origin differs from the
  // configured canonical origin (i.e. a preview/non-canonical host), use the
  // real browser origin so login returns to THIS deployment. Only the canonical
  // domain and SSR (no window) fall back to the configured origin.
  const useBrowserOrigin =
    browserOrigin !== null &&
    (process.env.NODE_ENV === "development" || browserOrigin !== configuredOrigin);

  const origin = useBrowserOrigin
    ? browserOrigin
    : configuredOrigin ?? browserOrigin;

  if (!origin) {
    throw new Error("로그인 리디렉션 URL을 만들 수 없습니다.");
  }

  return `${origin}/auth/callback`;
}
