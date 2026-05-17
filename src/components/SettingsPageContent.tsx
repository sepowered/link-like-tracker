"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { useSettings } from "@/components/SettingsProvider";
import { getAuthCallbackUrl } from "@/lib/auth-redirect-url";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import type { VideoCategory } from "@/lib/video-category";
import {
  ActionButton,
  Checkbox as SeedCheckbox,
  Divider,
  HStack,
  Icon,
  VStack,
} from "@seed-design/react";
import { List, ListButtonItem, ListItem, ListSwitchItem } from "@/ui/list";
import { ListHeader } from "@/ui/list-header";
import { Switchmark } from "@/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/ui/radio-group";
import {
  BottomSheetRoot,
  BottomSheetContent,
  BottomSheetBody,
  BottomSheetFooter,
} from "@/ui/bottom-sheet";
import { Checkbox, CheckboxGroup } from "@/ui/checkbox";
import {
  AlertDialogRoot,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/ui/alert-dialog";
import { ResponsivePair } from "@seed-design/react";
import { Snackbar, useSnackbarAdapter } from "@/ui/snackbar";
import {
  IconCheckmarkFatFill,
  IconChevronRightLine,
  IconPersonCircleLine,
} from "@karrotmarket/react-monochrome-icon";

const CATEGORY_OPTIONS: { value: VideoCategory; label: string }[] = [
  { value: "story", label: "스토리" },
  { value: "music", label: "음악" },
  { value: "fesxlive", label: "FesxLIVE" },
  { value: "fesxrec", label: "FesxReC" },
  { value: "withxmeets", label: "With×MEETS" },
];

const GOOGLE_LOGO = (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" />
  </svg>
);

const REQUIRED_LOGIN_CONSENT = {
  privacy: false,
  overseasTransfer: false,
  ageOver14: false,
};

const LIST_VALUE_SUFFIX_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: "2px",
  color: "var(--seed-color-fg-neutral-subtle)",
  fontSize: "14px",
  lineHeight: 1,
} as const;

export default function SettingsPageContent() {
  const {
    colorScheme,
    setColorScheme,
    language,
    setLanguage,
    progressCategories,
    hidePrivateVideos,
    setProgressCategories,
    setHidePrivateVideos,
  } = useSettings();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const adapter = useSnackbarAdapter();
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [progressSheetOpen, setProgressSheetOpen] = useState(false);
  const [loginSheetOpen, setLoginSheetOpen] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [loginConsent, setLoginConsent] = useState(REQUIRED_LOGIN_CONSENT);
  const [loginLoading, setLoginLoading] = useState(false);
  const [pendingCategories, setPendingCategories] = useState<VideoCategory[]>(progressCategories);
  const allLoginConsentChecked = Object.values(loginConsent).every(Boolean);

  function handleProgressSheetOpenChange(open: boolean) {
    if (open) setPendingCategories(progressCategories);
    setProgressSheetOpen(open);
  }

  function handleLoginSheetOpenChange(open: boolean) {
    if (open) {
      setLoginConsent(REQUIRED_LOGIN_CONSENT);
      setLoginLoading(false);
    }
    setLoginSheetOpen(open);
  }

  function handleLoginConsentChange(
    key: keyof typeof REQUIRED_LOGIN_CONSENT,
    checked: boolean,
  ) {
    setLoginConsent((prev) => ({ ...prev, [key]: checked }));
  }

  function handlePendingToggle(value: VideoCategory, checked: boolean) {
    setPendingCategories((prev) =>
      checked ? [...new Set([...prev, value])] : prev.filter((v) => v !== value),
    );
  }

  async function handleGoogleSignIn() {
    if (!allLoginConsentChecked || loginLoading) return;

    setLoginLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getAuthCallbackUrl() },
    });

    if (error) {
      setLoginLoading(false);
      adapter.create({
        render: () => <Snackbar variant="critical" message="Google 로그인 연결에 실패했어요." />,
      });
    }
  }

  function handleSave() {
    setProgressCategories(pendingCategories);
    setProgressSheetOpen(false);
    adapter.create({
      render: () => <Snackbar variant="positive" message="진행률 표시 기준을 저장했어요." />,
    });
  }

  const progressLabel =
    progressCategories.length === 0
      ? "전체"
      : progressCategories
          .map((c) => CATEGORY_OPTIONS.find((o) => o.value === c)?.label ?? c)
          .join(", ");

  const colorSchemeLabel =
    colorScheme === "dark" ? "다크" : colorScheme === "light" ? "라이트" : "시스템";
  const languageLabel = language === "jp" ? "日本語" : "한국어";

  return (
    <div className="settings-page">
      <PageHeader title="설정" borderBottom={false} />

      <VStack gap="x6">
        <VStack gap="x3">
          <ListHeader as="h2">계정 및 동기화</ListHeader>
          <List>
            {user ? (
              <>
                <ListItem
                  title={user.user_metadata?.full_name ?? user.email ?? "연결됨"}
                  detail={user.user_metadata?.full_name ? user.email : undefined}
                  prefix={
                    user.user_metadata?.avatar_url
                      ? <img src={user.user_metadata.avatar_url} alt="" width={32} height={32} style={{ borderRadius: "50%", flexShrink: 0 }} />
                      : <Icon svg={<IconPersonCircleLine />} size="32px" />
                  }
                  suffix={
                    <HStack color="fg.neutralSubtle" style={{ fontSize: "12px" }}>
                      연결됨
                    </HStack>
                  }
                />
                <ListButtonItem
                  title="기기 및 동기화 관리"
                  detail="기기 목록과 기록 합치기 설정을 관리해요."
                  onClick={() => router.push("/settings/sync")}
                  suffix={<Icon svg={<IconChevronRightLine />} size="16px" color="fg.neutralSubtle" />}
                />
                <ListButtonItem
                  title="로그아웃"
                  onClick={() => setLogoutSheetOpen(true)}
                  suffix={<Icon svg={<IconChevronRightLine />} size="16px" color="fg.neutralSubtle" />}
                />
              </>
            ) : (
              <ListButtonItem
                title="Google로 로그인"
                detail="로그인하면 스마트폰, 태블릿, 웹 어디서든 시청 기록을 동기화해요."
                onClick={() => handleLoginSheetOpenChange(true)}
                prefix={
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
                    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z"/>
                  </svg>
                }
              />
            )}
          </List>
        </VStack>

        <Divider />

        <VStack>
          <ListHeader as="h2">테마</ListHeader>
          <List>
            <ListButtonItem
              title="화면 스타일"
              onClick={() => setThemeSheetOpen(true)}
              suffix={
                <span style={LIST_VALUE_SUFFIX_STYLE}>
                  {colorSchemeLabel}
                  <Icon svg={<IconChevronRightLine />} size="16px" />
                </span>
              }
            />
            <ListButtonItem
              title="콘텐츠 제목 언어"
              onClick={() => setLanguageSheetOpen(true)}
              suffix={
                <span style={LIST_VALUE_SUFFIX_STYLE}>
                  {languageLabel}
                  <Icon svg={<IconChevronRightLine />} size="16px" />
                </span>
              }
            />
          </List>
        </VStack>

        <Divider />

        <VStack>
          <ListHeader as="h2">보기 옵션</ListHeader>
          <List>
            <ListSwitchItem
              title="비공개 영상 숨기기"
              checked={hidePrivateVideos}
              onCheckedChange={setHidePrivateVideos}
              suffix={<Switchmark tone="neutral" />}
            />
            <ListButtonItem
              title="진행률 표시 기준"
              onClick={() => setProgressSheetOpen(true)}
              suffix={
                <span style={LIST_VALUE_SUFFIX_STYLE}>
                  {progressLabel}
                  <Icon svg={<IconChevronRightLine />} size="16px" />
                </span>
              }
            />
          </List>
        </VStack>
      </VStack>

      <BottomSheetRoot
        open={themeSheetOpen}
        onOpenChange={setThemeSheetOpen}
        closeOnEscape
        closeOnInteractOutside
      >
        <BottomSheetContent
          title="화면 스타일"
          showCloseButton
          aria-describedby={undefined}
          style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}
        >
          <BottomSheetBody style={{ paddingBottom: "var(--seed-dimension-x6)" }}>
            <RadioGroup
              aria-label="화면 스타일"
              value={colorScheme}
              onValueChange={(v) => setColorScheme(v as "light" | "dark" | "system")}
            >
              <RadioGroupItem value="system" label="시스템 설정 사용" tone="neutral" size="large" />
              <RadioGroupItem value="light" label="라이트" tone="neutral" size="large" />
              <RadioGroupItem value="dark" label="다크" tone="neutral" size="large" />
            </RadioGroup>
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheetRoot>

      <BottomSheetRoot
        open={languageSheetOpen}
        onOpenChange={setLanguageSheetOpen}
        closeOnEscape
        closeOnInteractOutside
      >
        <BottomSheetContent
          title="콘텐츠 제목 언어"
          showCloseButton
          aria-describedby={undefined}
          style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}
        >
          <BottomSheetBody style={{ paddingBottom: "var(--seed-dimension-x6)" }}>
            <RadioGroup
              aria-label="콘텐츠 제목 언어"
              value={language}
              onValueChange={(v) => setLanguage(v as "ko" | "jp")}
            >
              <RadioGroupItem value="ko" label="한국어" tone="neutral" size="large" />
              <RadioGroupItem value="jp" label="日本語" tone="neutral" size="large" />
            </RadioGroup>
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheetRoot>

      <BottomSheetRoot
        open={loginSheetOpen}
        onOpenChange={handleLoginSheetOpenChange}
        closeOnEscape
        closeOnInteractOutside
      >
        <BottomSheetContent
          title="시청 기록을 이어보려면 동의가 필요해요"
          description="Google 계정으로 로그인하고 스마트폰, 태블릿, 웹 어디서든 시청 기록을 동기화해요."
          showCloseButton
          style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}
        >
          <BottomSheetBody style={{ paddingBottom: "var(--seed-dimension-x4)" }}>
            <CheckboxGroup
              label="개인정보 동의"
              indicator="필수"
              description="Google 계정 정보는 로그인과 시청 기록 동기화에만 사용돼요."
            >
              <Checkbox
                label={
                  <>
                    <Link
                      href="/terms/privacy"
                      onClick={(event) => event.stopPropagation()}
                      className="settings-consent-link"
                    >
                      개인정보 처리방침
                    </Link>
                    에 동의해요
                  </>
                }
                tone="neutral"
                size="large"
                checked={loginConsent.privacy}
                onCheckedChange={(checked) => handleLoginConsentChange("privacy", checked)}
              />
              <Checkbox
                label="개인정보 국외 처리에 동의해요"
                tone="neutral"
                size="large"
                checked={loginConsent.overseasTransfer}
                onCheckedChange={(checked) => handleLoginConsentChange("overseasTransfer", checked)}
              />
              <Checkbox
                label="만 14세 이상이에요"
                tone="neutral"
                size="large"
                checked={loginConsent.ageOver14}
                onCheckedChange={(checked) => handleLoginConsentChange("ageOver14", checked)}
              />
            </CheckboxGroup>
          </BottomSheetBody>
          <BottomSheetFooter>
            <ActionButton
              variant="neutralSolid"
              size="large"
              onClick={handleGoogleSignIn}
              disabled={!allLoginConsentChecked || loginLoading}
              loading={loginLoading}
              style={{ width: "100%", gap: "10px" }}
            >
              {GOOGLE_LOGO}
              Google로 계속하기
            </ActionButton>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheetRoot>

      <AlertDialogRoot open={logoutSheetOpen} onOpenChange={setLogoutSheetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>로그아웃할까요?</AlertDialogTitle>
            <AlertDialogDescription>로그아웃해도 이 기기의 시청 기록은 남아있어요.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <ResponsivePair gap="x2">
              <AlertDialogAction variant="neutralWeak" onClick={() => setLogoutSheetOpen(false)}>취소</AlertDialogAction>
              <AlertDialogAction variant="criticalSolid" onClick={() => { setLogoutSheetOpen(false); signOut(); }}>로그아웃</AlertDialogAction>
            </ResponsivePair>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>

      <BottomSheetRoot
        open={progressSheetOpen}
        onOpenChange={handleProgressSheetOpenChange}
        closeOnEscape
        closeOnInteractOutside
      >
        <BottomSheetContent
          title="진행률 표시 기준"
          showCloseButton
          aria-describedby={undefined}
          style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}
        >
          <BottomSheetBody style={{ paddingBottom: "var(--seed-dimension-x4)" }}>
            <p className="settings-sheet-hint">
              분류를 선택하면 해당 영상만 기준으로 진행률이 표시돼요. 선택하지 않으면 전체를 표시해요.
            </p>
            <SeedCheckbox.Group aria-label="진행률 표시 기준">
              {CATEGORY_OPTIONS.map((item) => (
                <SeedCheckbox.Root
                  key={item.value}
                  checked={pendingCategories.includes(item.value)}
                  onCheckedChange={(checked) => handlePendingToggle(item.value, checked)}
                  tone="neutral"
                  size="large"
                >
                  <SeedCheckbox.HiddenInput />
                  <SeedCheckbox.Control>
                    <SeedCheckbox.Indicator checked={<IconCheckmarkFatFill />} />
                  </SeedCheckbox.Control>
                  <SeedCheckbox.Label>{item.label}</SeedCheckbox.Label>
                </SeedCheckbox.Root>
              ))}
            </SeedCheckbox.Group>
          </BottomSheetBody>
          <BottomSheetFooter>
            <ActionButton
              variant="neutralSolid"
              size="large"
              style={{ width: "100%" }}
              onClick={handleSave}
            >
              설정 저장
            </ActionButton>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheetRoot>
    </div>
  );
}
