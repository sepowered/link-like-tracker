"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { ActionButton, VStack } from "@seed-design/react";

type CallbackState = "loading" | "closing" | "failed";

/**
 * iOS PWA에서 Google OAuth 후 Safari View Controller(SVC)를 닫기 위한 처리.
 * 세션 처리 완료 후 window.close()를 시도하고, 닫히지 않으면 사용자에게 안내 UI를 표시.
 */
function tryCloseWindow() {
  // SVC가 닫히는지 확인하기 위해 짧은 딜레이 후 체크
  window.close();
}

export default function AuthCallbackPage() {
  const [state, setState] = useState<CallbackState>("loading");

  useEffect(() => {
    const hash = window.location.hash;

    // Implicit flow: hash에 access_token이 있으면 세션 파싱 후 창 닫기 시도
    if (hash.includes("access_token")) {
      const supabase = getSupabaseBrowserClient();
      // Supabase가 hash에서 세션을 자동으로 파싱하도록 트리거
      supabase.auth.getSession().then(() => {
        setState("closing");
        tryCloseWindow();
      });
      return;
    }

    // PKCE flow: code 교환 후 창 닫기 시도
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.exchangeCodeForSession(code).then(({ data }) => {
        if (data.session) {
          setState("closing");
          tryCloseWindow();
        } else {
          setState("failed");
        }
      });
      return;
    }

    setState("failed");
  }, []);

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "var(--seed-color-bg-layer-default)",
      padding: "var(--seed-dimension-x6)",
    }}>
      <VStack align="center" gap="x4" style={{ textAlign: "center", maxWidth: "280px" }}>
        {state === "loading" && (
          <p style={{ fontSize: "15px", color: "var(--seed-color-fg-neutral-subtle)", margin: 0 }}>
            로그인 처리 중...
          </p>
        )}

        {state === "closing" && (
          <>
            <p style={{ fontSize: "20px", margin: 0 }}>✅</p>
            <p style={{ fontSize: "16px", fontWeight: "700", color: "var(--seed-color-fg-neutral)", margin: 0 }}>
              로그인 완료!
            </p>
            <p style={{ fontSize: "14px", color: "var(--seed-color-fg-neutral-subtle)", margin: 0, lineHeight: 1.6 }}>
              이 창을 닫으면 앱으로 돌아갈 수 있어요.
            </p>
            <ActionButton
              variant="neutralSolid"
              size="large"
              style={{ width: "100%" }}
              onClick={() => window.close()}
            >
              창 닫기
            </ActionButton>
          </>
        )}

        {state === "failed" && (
          <>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "var(--seed-color-fg-critical)", margin: 0 }}>
              로그인에 실패했어요.
            </p>
            <p style={{ fontSize: "14px", color: "var(--seed-color-fg-neutral-subtle)", margin: 0 }}>
              뒤로 가서 다시 시도해요.
            </p>
          </>
        )}
      </VStack>
    </div>
  );
}
