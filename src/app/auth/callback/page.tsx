"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { VStack } from "@seed-design/react";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const code = new URLSearchParams(window.location.search).get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setStatus("error");
        } else {
          setStatus("success");
          setTimeout(() => { try { window.close(); } catch {} }, 1200);
        }
      });
    } else {
      setStatus("error");
    }
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
        {status === "loading" && (
          <p style={{ fontSize: "15px", color: "var(--seed-color-fg-neutral-subtle)", margin: 0 }}>
            로그인 처리 중...
          </p>
        )}
        {status === "success" && (
          <>
            <p style={{ fontSize: "18px", fontWeight: "700", color: "var(--seed-color-fg-neutral)", margin: 0, letterSpacing: "-0.02em" }}>
              로그인 성공!
            </p>
            <p style={{ fontSize: "14px", color: "var(--seed-color-fg-neutral-subtle)", margin: 0 }}>
              창이 자동으로 닫혀요.
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "var(--seed-color-fg-critical)", margin: 0 }}>
              로그인에 실패했어요.
            </p>
            <p style={{ fontSize: "14px", color: "var(--seed-color-fg-neutral-subtle)", margin: 0 }}>
              창을 닫고 다시 시도해주세요.
            </p>
          </>
        )}
      </VStack>
    </div>
  );
}
