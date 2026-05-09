"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { ActionButton, Icon, VStack } from "@seed-design/react";
import { IconChevronLeftLine } from "@karrotmarket/react-monochrome-icon";
import { Checkbox, CheckboxGroup } from "@/ui/checkbox";

const GOOGLE_LOGO = (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" />
  </svg>
);

export default function AuthConnectPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    if (!agreed) return;
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "var(--seed-dimension-x12) var(--seed-dimension-x5) var(--seed-dimension-x8)",
      backgroundColor: "var(--seed-color-bg-layer-default)",
      position: "relative",
    }}>
      <ActionButton
        layout="iconOnly"
        variant="ghost"
        size="small"
        aria-label="뒤로"
        onClick={() => router.back()}
        style={{ position: "absolute", top: "var(--seed-dimension-x3)", left: "var(--seed-dimension-x3)" }}
      >
        <Icon svg={<IconChevronLeftLine />} />
      </ActionButton>

      <VStack gap="x2">
        <p style={{
          fontSize: "13px",
          fontWeight: "600",
          color: "var(--seed-color-fg-brand)",
          margin: 0,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}>
          lltracker
        </p>
        <h1 style={{
          fontSize: "26px",
          fontWeight: "800",
          color: "var(--seed-color-fg-neutral)",
          letterSpacing: "-0.03em",
          margin: 0,
          lineHeight: 1.25,
        }}>
          시청 기록,<br />어디서든 이어가요
        </h1>
        <p style={{
          fontSize: "14px",
          color: "var(--seed-color-fg-neutral-subtle)",
          margin: 0,
          lineHeight: 1.6,
          marginTop: "var(--seed-dimension-x1)",
        }}>
          Google로 로그인하면 스마트폰, 태블릿, 웹에서<br />시청 상태가 자동으로 동기화돼요.
        </p>
      </VStack>

      <VStack gap="x3">
        <CheckboxGroup indicator="필수" aria-label="개인정보 처리방침 동의">
          <Checkbox
            label="개인정보 처리방침에 동의해요"
            tone="neutral"
            checked={agreed}
            onCheckedChange={setAgreed}
          />
        </CheckboxGroup>

        <ActionButton
          variant="neutralSolid"
          size="large"
          onClick={handleGoogleSignIn}
          disabled={!agreed || loading}
          style={{ width: "100%", gap: "10px" }}
        >
          {GOOGLE_LOGO}
          {loading ? "연결 중..." : "Google로 계속하기"}
        </ActionButton>

        <p style={{
          fontSize: "12px",
          color: "var(--seed-color-fg-placeholder)",
          textAlign: "center",
          margin: 0,
          lineHeight: 1.6,
        }}>
          Google 계정 정보만 사용해요.
        </p>
      </VStack>
    </div>
  );
}
