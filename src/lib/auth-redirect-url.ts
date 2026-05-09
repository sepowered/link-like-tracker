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

  const origin = configuredOrigin ?? browserOrigin;

  if (!origin) {
    throw new Error("로그인 리디렉션 URL을 만들 수 없습니다.");
  }

  return `${origin}/auth/callback`;
}
