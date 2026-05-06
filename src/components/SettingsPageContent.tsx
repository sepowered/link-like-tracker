"use client";

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
  SegmentedControl,
  Switch,
} from "@seed-design/react";
import {
  BottomSheetRoot,
  BottomSheetTrigger,
  BottomSheetContent,
  BottomSheetBody,
} from "@/ui/bottom-sheet";
import {
  IconCheckmarkFatFill,
  IconChevronLeftLine,
  IconChevronRightLine,
  IconSunLine,
  IconMoonLine,
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

  function handleCategoryToggle(value: VideoCategory, checked: boolean) {
    let next: VideoCategory[];
    if (checked) {
      next = [...new Set([...progressCategories, value])];
    } else {
      next = progressCategories.filter((v) => v !== value);
    }
    setProgressCategories(next);
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

      <ListHeader as="h2">테마</ListHeader>
      <List.Root>
        <List.Item>
          <List.Content>
            <List.Title>다크 모드</List.Title>
          </List.Content>
          <List.Suffix>
            <SegmentedControl.Root
              value={colorScheme}
              onValueChange={(v) => setColorScheme(v as "light" | "dark")}
              aria-label="다크 모드"
              style={{ width: "fit-content", minWidth: "auto" }}
            >
              <SegmentedControl.Indicator />
              <SegmentedControl.Item value="light" style={{ minWidth: "40px", padding: "0 8px" }}>
                <SegmentedControl.ItemHiddenInput aria-label="라이트 모드" />
                <Icon svg={<IconSunLine />} size="20px" />
              </SegmentedControl.Item>
              <SegmentedControl.Item value="dark" style={{ minWidth: "40px", padding: "0 8px" }}>
                <SegmentedControl.ItemHiddenInput aria-label="다크 모드" />
                <Icon svg={<IconMoonLine />} size="20px" />
              </SegmentedControl.Item>
            </SegmentedControl.Root>
          </List.Suffix>
        </List.Item>
      </List.Root>

      <Divider />

      <ListHeader as="h2">뷰</ListHeader>
      <List.Root>
        <List.Item asChild>
          <Switch.Root checked={hidePrivateVideos} onCheckedChange={setHidePrivateVideos} style={{ alignItems: "center" }}>
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
      </List.Root>

      <Divider />

      <BottomSheetRoot closeOnEscape closeOnInteractOutside>
        <ListHeader as="h2">진행률</ListHeader>
        <List.Root>
          <BottomSheetTrigger asChild>
            <List.Item asChild>
              <button type="button">
                <List.Content>
                  <List.Title>표시 기준</List.Title>
                </List.Content>
                <List.Suffix style={{ color: "var(--seed-color-fg-neutral-subtle)", fontSize: "14px", display: "flex", alignItems: "center", gap: "2px" }}>
                  {progressLabel}
                  <Icon svg={<IconChevronRightLine />} size="16px" />
                </List.Suffix>
              </button>
            </List.Item>
          </BottomSheetTrigger>
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
                  checked={progressCategories.includes(item.value)}
                  onCheckedChange={(checked) => handleCategoryToggle(item.value, checked)}
                  tone="brand"
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
        </BottomSheetContent>
      </BottomSheetRoot>
    </div>
  );
}
