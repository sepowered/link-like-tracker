'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '20px' }}>문제가 발생했습니다.</h1>
          <p style={{ margin: 0, color: 'var(--seed-color-fg-neutral-muted)', fontSize: '14px' }}>
            페이지를 다시 불러오거나 잠시 후 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              border: '1px solid var(--seed-color-stroke-neutral-weak)',
              borderRadius: '8px',
              background: 'var(--seed-color-bg-layer-default)',
              padding: '10px 14px',
              cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
