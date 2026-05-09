"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { VStack } from "@seed-design/react";

export default function AuthCallbackPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;

    // Implicit flow: forward hash to root, AuthProvider handles session setup
    if (hash.includes("access_token")) {
      window.location.replace("/" + hash);
      return;
    }

    // PKCE flow: exchange code then redirect
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.exchangeCodeForSession(code).then(({ data }) => {
        if (data.session) {
          window.location.replace("/");
        } else {
          setFailed(true);
        }
      });
      return;
    }

    setFailed(true);
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
      <VStack align="center" gap="x2" style={{ textAlign: "center" }}>
        {!failed ? (
          <p style={{ fontSize: "15px", color: "var(--seed-color-fg-neutral-subtle)", margin: 0 }}>
            로그인 처리 중...
          </p>
        ) : (
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
