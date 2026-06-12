"use client";

import { useState } from "react";
import Link from "next/link";
import { getAuthCallbackUrl } from "@/lib/auth-redirect-url";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { ActionButton, Text, VStack } from "@seed-design/react";
import { Checkbox, CheckboxGroup } from "@/ui/checkbox";
import PageHeader from "@/components/PageHeader";

const GOOGLE_LOGO = (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" />
  </svg>
);

const INITIAL_CONSENT = { privacy: false, overseasTransfer: false, ageOver14: false };

export default function AuthConnectPage() {
  const [consent, setConsent] = useState(INITIAL_CONSENT);
  const [loading, setLoading] = useState(false);
  const allChecked = Object.values(consent).every(Boolean);

  function handleConsentChange(key: keyof typeof INITIAL_CONSENT, checked: boolean) {
    setConsent((prev) => ({ ...prev, [key]: checked }));
  }

  async function handleGoogleSignIn() {
    if (!allChecked || loading) return;
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getAuthCallbackUrl() },
    });
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100dvh",
      backgroundColor: "var(--seed-color-bg-layer-default)",
    }}>
      <PageHeader title="" borderBottom={false} />

      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "var(--seed-dimension-x3) var(--seed-dimension-x5) calc(var(--seed-dimension-x8) + var(--seed-safe-area-bottom))",
      }}>
        <VStack gap="x3">
          <Text textStyle="t8Bold" color="fg.neutral" whiteSpace="pre-line">
            {"시청 기록을\n이어보려면 동의가 필요해요"}
          </Text>
          <Text textStyle="t5Regular" color="fg.neutralMuted">
            Google 계정으로 로그인하고 스마트폰, 태블릿, 웹 어디서든 시청 기록을 동기화해요.
          </Text>
        </VStack>

        <VStack gap="x4">
          <CheckboxGroup
            label="개인정보 동의"
            indicator="필수"
            description="Google 계정 정보는 로그인과 시청 기록 동기화에만 사용돼요."
          >
            <Checkbox
              label={
                <>
                  <Link href="/terms/privacy" onClick={(e) => e.stopPropagation()} className="settings-consent-link">
                    개인정보 처리방침
                  </Link>
                  에 동의해요
                </>
              }
              tone="neutral"
              size="large"
              checked={consent.privacy}
              onCheckedChange={(checked) => handleConsentChange("privacy", checked)}
            />
            <Checkbox
              label="개인정보 국외 처리에 동의해요"
              tone="neutral"
              size="large"
              checked={consent.overseasTransfer}
              onCheckedChange={(checked) => handleConsentChange("overseasTransfer", checked)}
            />
            <Checkbox
              label="만 14세 이상이에요"
              tone="neutral"
              size="large"
              checked={consent.ageOver14}
              onCheckedChange={(checked) => handleConsentChange("ageOver14", checked)}
            />
          </CheckboxGroup>

          <ActionButton
            variant="neutralSolid"
            size="large"
            onClick={handleGoogleSignIn}
            disabled={!allChecked || loading}
            loading={loading}
            style={{ width: "100%", gap: "10px" }}
          >
            {GOOGLE_LOGO}
            Google로 계속하기
          </ActionButton>
        </VStack>
      </div>
    </div>
  );
}
