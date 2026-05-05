"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/components/SettingsProvider";
import type { VideoCategory } from "@/lib/video-category";
import {
  ActionButton,
  Divider,
  Icon,
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
  CheckSelectBoxGroup,
  CheckSelectBox,
  CheckSelectBoxCheckmark,
} from "@/ui/select-box";
import {
  IconGearLine,
  IconSunLine,
  IconMoonLine,
} from "@karrotmarket/react-monochrome-icon";

type ColorScheme = "light" | "dark";

const CATEGORY_OPTIONS: { value: VideoCategory; label: string }[] = [
  { value: "story", label: "스토리" },
  { value: "music", label: "음악" },
  { value: "fesxlive", label: "FesxLIVE" },
  { value: "fesxrec", label: "FesxReC" },
  { value: "withxmeets", label: "With×MEETS" },
];

function getCurrentScheme(): ColorScheme {
  if (typeof window === "undefined") return "light";
  return document.documentElement.dataset.seedColorMode === "dark-only" ? "dark" : "light";
}

export default function SettingsSheet() {
  const { progressCategories, hidePrivateVideos, setProgressCategories, setHidePrivateVideos } =
    useSettings();
  const [scheme, setScheme] = useState<ColorScheme>("light");

  useEffect(() => {
    setScheme(getCurrentScheme());
  }, []);

  function handleThemeChange(value: string) {
    const next = value as ColorScheme;
    document.documentElement.dataset.seedColorMode = next === "dark" ? "dark-only" : "light-only";
    setScheme(next);
    try {
      localStorage.setItem("seed-color-scheme", next);
    } catch (e) {
      console.error("Failed to save theme to localStorage", e);
    }
  }

  function handleCategoryToggle(value: VideoCategory, checked: boolean) {
    let next: VideoCategory[];
    if (checked) {
      next = [...new Set([...progressCategories, value])];
    } else {
      next = progressCategories.filter((v) => v !== value);
    }
    setProgressCategories(next);
  }

  return (
    <BottomSheetRoot closeOnEscape closeOnInteractOutside>
      <BottomSheetTrigger asChild>
        <ActionButton variant="ghost" size="small" aria-label="설정">
          <Icon svg={<IconGearLine />} size="22px" />
        </ActionButton>
      </BottomSheetTrigger>
      <BottomSheetContent title="설정" showCloseButton>
        <BottomSheetBody>
          <section className="settings-section-block">
            <h2 className="settings-section-title">테마</h2>
            <div className="settings-row">
              <span className="settings-row-label">다크 모드</span>
              <SegmentedControl.Root
                value={scheme}
                onValueChange={handleThemeChange}
                style={{ width: "fit-content", minWidth: "auto" }}
              >
                <SegmentedControl.Indicator />
                <SegmentedControl.Item value="light" style={{ minWidth: "40px", padding: "0 8px" }}>
                  <SegmentedControl.ItemHiddenInput />
                  <Icon svg={<IconSunLine />} size="20px" />
                </SegmentedControl.Item>
                <SegmentedControl.Item value="dark" style={{ minWidth: "40px", padding: "0 8px" }}>
                  <SegmentedControl.ItemHiddenInput />
                  <Icon svg={<IconMoonLine />} size="20px" />
                </SegmentedControl.Item>
              </SegmentedControl.Root>
            </div>
          </section>

          <Divider />

          <section className="settings-section-block">
            <h2 className="settings-section-title">뷰</h2>
            <div className="settings-row">
              <span className="settings-row-label">비공개 영상 숨기기</span>
              <Switch.Root checked={hidePrivateVideos} onCheckedChange={setHidePrivateVideos}>
                <Switch.HiddenInput />
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Root>
            </div>
          </section>

          <Divider />

          <section className="settings-section-block">
            <h2 className="settings-section-title">진행률 표시 기준</h2>
            <p style={{ fontSize: "13px", color: "var(--seed-color-fg-neutral-subtle)", margin: "0 0 12px 0" }}>
              선택하지 않으면 전체 영상을 기준으로 표시됩니다
            </p>
            <CheckSelectBoxGroup aria-label="진행률 표시 기준">
              {CATEGORY_OPTIONS.map((item) => (
                <CheckSelectBox
                  key={item.value}
                  label={item.label}
                  checked={progressCategories.includes(item.value)}
                  onCheckedChange={(checked) => handleCategoryToggle(item.value, checked)}
                  suffix={<CheckSelectBoxCheckmark />}
                />
              ))}
            </CheckSelectBoxGroup>
          </section>
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheetRoot>
  );
}
