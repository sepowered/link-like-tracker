"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Content } from "@/types";
import { VideoCategory, getVideoCategoryLabel } from "@/lib/video-category";
import { Checkbox, PrefixIcon, MenuSheet, ActionButton, HStack, Portal } from "@seed-design/react";
import { Chip } from "@/ui/chip";
import { Snackbar, useSnackbarAdapter } from "@/ui/snackbar";
import {
  BottomSheetRoot,
  BottomSheetTrigger,
  BottomSheetContent,
  BottomSheetBody,
  BottomSheetFooter,
} from "@/ui/bottom-sheet";
import {
  IconCheckmarkLine,
  IconArrowUpRightLine,
  IconAndroidshareLine,
  IconPaperclipLine,
  IconPencilLine,
} from "@karrotmarket/react-monochrome-icon";
import { useSettings } from "./SettingsProvider";

type CategoryOverrideArg = "story" | "music" | "fesxlive" | "fesxrec" | "withxmeets" | null | "auto";

interface Props {
  content: Content;
  onToggle: (contentId: string) => void;
  onUpdateCategory: (contentId: string, categoryOverride: CategoryOverrideArg) => void;
}

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "자동 분류" },
  { value: "story", label: "스토리" },
  { value: "music", label: "음악" },
  { value: "fesxlive", label: "FesxLIVE" },
  { value: "fesxrec", label: "FesxReC" },
  { value: "withxmeets", label: "With×MEETS" },
  { value: "none", label: "태그 없음" },
];

function toRo(text: string): string {
  const last = text[text.length - 1];
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 === 0 ? "로" : "으로";
  return /[aeiouAEIOU]/.test(last) ? "로" : "으로";
}

function getDisplayTitle(content: Content, language: "ko" | "jp"): string {
  if (content.type === "story") {
    return content.part_label ?? "";
  }
  if (language === "jp") return content.title_jp ?? content.title_ko ?? "";
  return content.title_ko ?? content.title_jp ?? "";
}

export default function ContentItem({ content, onToggle, onUpdateCategory }: Props) {
  const router = useRouter();
  const { language } = useSettings();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const adapter = useSnackbarAdapter();

  const effectiveCategory =
    content.categoryOverride !== undefined ? content.categoryOverride : (content.type as VideoCategory | null);
  const categoryLabel = getVideoCategoryLabel(effectiveCategory as Exclude<VideoCategory, "all"> | null);
  const currentCategoryValue =
    content.categoryOverride === undefined
      ? "auto"
      : content.categoryOverride === null
        ? "none"
        : content.categoryOverride;

  const preferredLabel = language === "ko" ? "자막본" : "원본";
  const primarySource =
    content.sources.find((s) => s.label === preferredLabel) ?? content.sources[0];
  // 메뉴에서도 선호 언어 소스가 먼저 보이도록 정렬(같은 라벨끼리는 원래 순서 유지)
  const orderedSources = [...content.sources].sort(
    (a, b) => Number(b.label === preferredLabel) - Number(a.label === preferredLabel),
  );

  const hasKo = content.sources.some((s) => s.label === "자막본");
  const hasJp = content.sources.some((s) => s.label === "원본");
  const sourceMismatchBadge: string | null =
    language === "ko" && !hasKo && hasJp
      ? "원본만"
      : language === "jp" && !hasJp && hasKo
        ? "자막본만"
        : null;

  const displayTitle = getDisplayTitle(content, language);

  const handleToggleWatch = () => {
    onToggle(content.id);
    setSheetOpen(false);
  };

  const handleOpenSource = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    setSheetOpen(false);
  };

  const handleShare = async () => {
    if (!primarySource) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: displayTitle || categoryLabel, url: primarySource.url });
      } catch (err) {
        console.error("공유 실패:", err);
      }
    } else {
      alert("이 브라우저에서는 공유 기능을 지원하지 않습니다.");
    }
    setSheetOpen(false);
  };

  const handleCopyLink = async () => {
    if (!primarySource) return;
    try {
      await navigator.clipboard.writeText(primarySource.url);
      adapter.create({ render: () => <Snackbar message="링크가 복사되었습니다." /> });
    } catch (err) {
      console.error("복사 실패:", err);
    }
    setSheetOpen(false);
  };

  const handleEditRequest = () => {
    setSheetOpen(false);
    router.push(`/edit-request/${content.id}`);
  };

  const handleCategoryConfirm = (value: string) => {
    if (value === currentCategoryValue) return;

    const previousValue = currentCategoryValue;
    const newLabel = CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value;

    if (value === "auto") {
      onUpdateCategory(content.id, "auto");
    } else if (value === "none") {
      onUpdateCategory(content.id, null);
    } else {
      onUpdateCategory(content.id, value as Exclude<VideoCategory, "all">);
    }

    adapter.create({
      render: () => (
        <Snackbar
          message={`${newLabel}${toRo(newLabel)} 변경했어요`}
          actionLabel="되돌리기"
          onAction={() => {
            if (previousValue === "auto") {
              onUpdateCategory(content.id, "auto");
            } else if (previousValue === "none") {
              onUpdateCategory(content.id, null);
            } else {
              onUpdateCategory(content.id, previousValue as Exclude<VideoCategory, "all">);
            }
          }}
        />
      ),
    });
  };

  const menuTitle = displayTitle || `${categoryLabel} — ${content.sources.map((s) => s.label).join(" / ")}`;

  return (
    <div id={`content-${content.id}`} className={`video-item${content.watched ? " watched" : ""}`}>
      <Checkbox.Root
        checked={content.watched}
        onCheckedChange={() => onToggle(content.id)}
        size="medium"
        style={{ flexShrink: 0 }}
      >
        <Checkbox.HiddenInput aria-label={`${menuTitle} 시청 완료`} />
        <Checkbox.Control>
          <Checkbox.Indicator checked={<IconCheckmarkLine />} />
        </Checkbox.Control>
      </Checkbox.Root>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
        {/* 분류 상세 설정 */}
        <BottomSheetRoot
          closeOnEscape
          closeOnInteractOutside
          open={categorySheetOpen}
          onOpenChange={setCategorySheetOpen}
        >
          <BottomSheetTrigger asChild>
            <Chip.Button variant="outlineWeak" size="small" style={{ flexShrink: 0 }}>
              <Chip.Label>{categoryLabel}</Chip.Label>
            </Chip.Button>
          </BottomSheetTrigger>
          <Portal>
            <CategorySheet
              currentValue={currentCategoryValue}
              onClose={() => setCategorySheetOpen(false)}
              onConfirm={(value) => {
                handleCategoryConfirm(value);
                setCategorySheetOpen(false);
              }}
            />
          </Portal>
        </BottomSheetRoot>

        {/* 언어 불일치 배지 */}
        {sourceMismatchBadge && (
          <Chip.Button
            variant="outlineWeak"
            size="small"
            style={{ flexShrink: 0, pointerEvents: "none" }}
            aria-label={`${sourceMismatchBadge} 소스만 있음`}
          >
            <Chip.Label>{sourceMismatchBadge}</Chip.Label>
          </Chip.Button>
        )}

        {/* 제목 + 소스 레이블 / 메뉴 트리거 */}
        <MenuSheet.Root open={sheetOpen} onOpenChange={setSheetOpen}>
          <MenuSheet.Trigger asChild>
            <span
              className="video-title"
              style={{
                cursor: "pointer",
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayTitle || content.sources.map((s) => s.label).join(" / ")}
            </span>
          </MenuSheet.Trigger>
          <MenuSheet.Backdrop />
          <MenuSheet.Positioner>
            <MenuSheet.Content>
              <MenuSheet.Header>
                <MenuSheet.Title>{menuTitle}</MenuSheet.Title>
              </MenuSheet.Header>
              <MenuSheet.List>
                <MenuSheet.Group>
                  <MenuSheet.Item onClick={handleToggleWatch}>
                    <PrefixIcon svg={<IconCheckmarkLine />} />
                    <MenuSheet.ItemContent>
                      <MenuSheet.ItemLabel>
                        {content.watched ? "시청 완료 취소" : "시청 완료 표시"}
                      </MenuSheet.ItemLabel>
                    </MenuSheet.ItemContent>
                  </MenuSheet.Item>
                </MenuSheet.Group>
                <MenuSheet.Group>
                  {orderedSources.map((source) => (
                    <MenuSheet.Item key={source.url} onClick={() => handleOpenSource(source.url)}>
                      <PrefixIcon svg={<IconArrowUpRightLine />} />
                      <MenuSheet.ItemContent>
                        <MenuSheet.ItemLabel>{source.label}으로 보기</MenuSheet.ItemLabel>
                      </MenuSheet.ItemContent>
                    </MenuSheet.Item>
                  ))}
                  <MenuSheet.Item onClick={handleShare}>
                    <PrefixIcon svg={<IconAndroidshareLine />} />
                    <MenuSheet.ItemContent>
                      <MenuSheet.ItemLabel>공유하기</MenuSheet.ItemLabel>
                    </MenuSheet.ItemContent>
                  </MenuSheet.Item>
                  <MenuSheet.Item onClick={handleCopyLink}>
                    <PrefixIcon svg={<IconPaperclipLine />} />
                    <MenuSheet.ItemContent>
                      <MenuSheet.ItemLabel>링크 복사</MenuSheet.ItemLabel>
                    </MenuSheet.ItemContent>
                  </MenuSheet.Item>
                </MenuSheet.Group>
                <MenuSheet.Group>
                  <MenuSheet.Item onClick={handleEditRequest}>
                    <PrefixIcon svg={<IconPencilLine />} />
                    <MenuSheet.ItemContent>
                      <MenuSheet.ItemLabel>정보 수정 요청</MenuSheet.ItemLabel>
                    </MenuSheet.ItemContent>
                  </MenuSheet.Item>
                </MenuSheet.Group>
              </MenuSheet.List>
            </MenuSheet.Content>
          </MenuSheet.Positioner>
        </MenuSheet.Root>
      </div>
    </div>
  );
}

function CategorySheet({
  currentValue,
  onConfirm,
}: {
  currentValue: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}) {
  const [selected, setSelected] = useState(currentValue);

  return (
    <BottomSheetContent
      title="분류 상세 설정"
      aria-describedby={undefined}
      style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}
    >
      <BottomSheetBody>
        <HStack gap="x2" wrap>
          {CATEGORY_OPTIONS.map((opt) => (
            <Chip.Toggle
              key={opt.value}
              variant="outlineStrong"
              size="medium"
              checked={selected === opt.value}
              onCheckedChange={(checked) => {
                if (checked) setSelected(opt.value);
              }}
            >
              <Chip.Label>{opt.label}</Chip.Label>
            </Chip.Toggle>
          ))}
        </HStack>
      </BottomSheetBody>
      <BottomSheetFooter>
        <HStack pt="x3">
          <ActionButton flexGrow size="large" variant="neutralSolid" onClick={() => onConfirm(selected)}>
            완료
          </ActionButton>
        </HStack>
      </BottomSheetFooter>
    </BottomSheetContent>
  );
}
