"use client";

import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useSettings } from "@/components/SettingsProvider";
import PageHeader from "@/components/PageHeader";
import type { VideoCategory } from "@/lib/video-category";
import {
  ActionButton,
  Checkbox,
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

export default function SettingsPageContent() {
  const {
    colorScheme,
    setColorScheme,
    progressCategories,
    hidePrivateVideos,
    setProgressCategories,
    setHidePrivateVideos,
  } = useSettings();
  const { user, signOut } = useAuth();
  const adapter = useSnackbarAdapter();
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [progressSheetOpen, setProgressSheetOpen] = useState(false);
  const [pendingCategories, setPendingCategories] = useState<VideoCategory[]>(progressCategories);

  function handleProgressSheetOpenChange(open: boolean) {
    if (open) setPendingCategories(progressCategories);
    setProgressSheetOpen(open);
  }

  function handlePendingToggle(value: VideoCategory, checked: boolean) {
    setPendingCategories((prev) =>
      checked ? [...new Set([...prev, value])] : prev.filter((v) => v !== value),
    );
  }

  function handleSave() {
    setProgressCategories(pendingCategories);
    setProgressSheetOpen(false);
    adapter.create({
      render: () => <Snackbar variant="positive" message="진행률 표시 기준이 저장되었어요" />,
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

  return (
    <div className="settings-page">
      <PageHeader title="설정" borderBottom={false} />

      <VStack gap="x6">
        <VStack>
          <ListHeader as="h2">테마</ListHeader>
          <List>
            <ListButtonItem
              title="화면 스타일"
              onClick={() => setThemeSheetOpen(true)}
              suffix={
                <HStack gap="x0_5" color="fg.neutralSubtle" style={{ fontSize: "14px" }}>
                  {colorSchemeLabel}
                  <Icon svg={<IconChevronRightLine />} size="16px" />
                </HStack>
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
                <span style={{ display: "flex", alignItems: "center", gap: "2px", color: "var(--seed-color-fg-neutral-subtle)", fontSize: "14px" }}>
                  {progressLabel}
                  <Icon svg={<IconChevronRightLine />} size="16px" />
                </span>
              }
            />
          </List>
        </VStack>

        <Divider />

        <VStack gap="x3">
          <ListHeader as="h2">연속성</ListHeader>
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
                  title="로그아웃"
                  onClick={signOut}
                  suffix={<Icon svg={<IconChevronRightLine />} size="16px" color="fg.neutralSubtle" />}
                />
              </>
            ) : (
              <ListButtonItem
                title="Google로 로그인"
                detail="로그인하면 스마트폰, 태블릿, 웹 어디서든 시청 기록을 동기화해요."
                onClick={() => window.open("/auth/connect", "_blank", "width=420,height=640,left=200,top=100,popup")}
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
            <Checkbox.Group aria-label="진행률 표시 기준">
              {CATEGORY_OPTIONS.map((item) => (
                <Checkbox.Root
                  key={item.value}
                  checked={pendingCategories.includes(item.value)}
                  onCheckedChange={(checked) => handlePendingToggle(item.value, checked)}
                  tone="neutral"
                  size="large"
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control>
                    <Checkbox.Indicator checked={<IconCheckmarkFatFill />} />
                  </Checkbox.Control>
                  <Checkbox.Label>{item.label}</Checkbox.Label>
                </Checkbox.Root>
              ))}
            </Checkbox.Group>
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
