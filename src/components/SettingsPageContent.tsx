"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/components/SettingsProvider";
import type { VideoCategory } from "@/lib/video-category";
import {
  ActionButton,
  Checkbox,
  Divider,
  Icon,
  List,
  ListHeader,
  Switch,
} from "@seed-design/react";
import { RadioGroup, RadioGroupItem } from "@/ui/radio-group";
import {
  BottomSheetRoot,
  BottomSheetTrigger,
  BottomSheetContent,
  BottomSheetBody,
  BottomSheetFooter,
} from "@/ui/bottom-sheet";
import { Snackbar, useSnackbarAdapter } from "@/ui/snackbar";
import {
  IconCheckmarkFatFill,
  IconChevronLeftLine,
  IconChevronRightLine,
} from "@karrotmarket/react-monochrome-icon";

const CATEGORY_OPTIONS: { value: VideoCategory; label: string }[] = [
  { value: "story", label: "스토리" },
  { value: "music", label: "음악" },
  { value: "fesxlive", label: "FesxLIVE" },
  { value: "fesxrec", label: "FesxReC" },
  { value: "withxmeets", label: "With×MEETS" },
];

export default function SettingsPageContent() {
  const router = useRouter();
  const {
    colorScheme,
    setColorScheme,
    progressCategories,
    hidePrivateVideos,
    setProgressCategories,
    setHidePrivateVideos,
  } = useSettings();
  const adapter = useSnackbarAdapter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingCategories, setPendingCategories] = useState<VideoCategory[]>(progressCategories);

  function handleSheetOpenChange(open: boolean) {
    if (open) setPendingCategories(progressCategories);
    setSheetOpen(open);
  }

  function handlePendingToggle(value: VideoCategory, checked: boolean) {
    setPendingCategories((prev) =>
      checked ? [...new Set([...prev, value])] : prev.filter((v) => v !== value),
    );
  }

  function handleSave() {
    setProgressCategories(pendingCategories);
    setSheetOpen(false);
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

  return (
    <div className="settings-page">
      <div className="settings-header">
        <ActionButton
          variant="ghost"
          size="small"
          onClick={() => router.back()}
          aria-label="뒤로 가기"
        >
          <Icon svg={<IconChevronLeftLine />} size="22px" />
        </ActionButton>
        <h1 className="settings-title">설정</h1>
        <div style={{ width: "36px" }} />
      </div>

      <BottomSheetRoot closeOnEscape closeOnInteractOutside>
        <ListHeader as="h2">테마</ListHeader>
        <List.Root style={{ margin: 0 }}>
          <List.Item>
            <BottomSheetTrigger asChild>
              <List.Content asChild>
                <button type="button">
                  <List.Title>화면 스타일</List.Title>
                </button>
              </List.Content>
            </BottomSheetTrigger>
            <List.Suffix style={{ color: "var(--seed-color-fg-neutral-subtle)", fontSize: "14px", display: "flex", alignItems: "center", gap: "2px" }}>
              {colorScheme === "dark" ? "다크" : colorScheme === "light" ? "라이트" : "시스템"}
              <Icon svg={<IconChevronRightLine />} size="16px" />
            </List.Suffix>
          </List.Item>
        </List.Root>
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

      <Divider style={{ marginTop: "var(--seed-dimension-x6)", marginBottom: "var(--seed-dimension-x6)" }} />

      <BottomSheetRoot open={sheetOpen} onOpenChange={handleSheetOpenChange} closeOnEscape closeOnInteractOutside>
        <ListHeader as="h2">보기 옵션</ListHeader>
        <List.Root style={{ margin: 0 }}>
          <List.Item asChild>
            <Switch.Root checked={hidePrivateVideos} onCheckedChange={setHidePrivateVideos} tone="neutral" style={{ alignItems: "center" }}>
              <Switch.HiddenInput />
              <List.Content>
                <List.Title>비공개 영상 숨기기</List.Title>
              </List.Content>
              <List.Suffix>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </List.Suffix>
            </Switch.Root>
          </List.Item>
          <List.Item>
            <BottomSheetTrigger asChild>
              <List.Content asChild>
                <button type="button">
                  <List.Title>진행률 표시 기준</List.Title>
                </button>
              </List.Content>
            </BottomSheetTrigger>
            <List.Suffix style={{ color: "var(--seed-color-fg-neutral-subtle)", fontSize: "14px", display: "flex", alignItems: "center", gap: "2px" }}>
              {progressLabel}
              <Icon svg={<IconChevronRightLine />} size="16px" />
            </List.Suffix>
          </List.Item>
        </List.Root>
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
            <ActionButton variant="neutralSolid" size="large" style={{ width: "100%" }} onClick={handleSave}>
              설정 저장
            </ActionButton>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheetRoot>
    </div>
  );
}
