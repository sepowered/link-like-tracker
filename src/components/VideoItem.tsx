"use client";

import { useState } from "react";
import { Video } from "@/types";
import { VideoCategory, getVideoCategoryLabel } from "@/lib/video-category";
import { Checkbox, Icon, MenuSheet, ActionButton, HStack, Portal } from "@seed-design/react";
import { Chip } from "@/ui/chip";
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
} from "@karrotmarket/react-monochrome-icon";

type CategoryOverrideArg = "story" | "music" | "fesxlive" | "fesxrec" | "withxmeets" | null | "auto";

interface Props {
  video: Video;
  category: Exclude<VideoCategory, "all"> | null;
  onToggle: (videoId: string) => void;
  onUpdateCategory: (videoId: string, categoryOverride: CategoryOverrideArg) => void;
}

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "자동 분류" },
  { value: "story", label: "스토리" },
  { value: "music", label: "음악" },
  { value: "fesxlive", label: "FesxLIVE" },
  { value: "withxmeets", label: "With×MEETS" },
  { value: "none", label: "태그 없음" },
];

export default function VideoItem({ video, category, onToggle, onUpdateCategory }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);

  const effectiveCategory =
    video.categoryOverride !== undefined ? video.categoryOverride : category;
  const categoryLabel = getVideoCategoryLabel(effectiveCategory);
  const isOverridden = video.categoryOverride !== undefined;

  const currentCategoryValue =
    video.categoryOverride === undefined
      ? "auto"
      : video.categoryOverride === null
        ? "none"
        : video.categoryOverride;

  const handleToggleWatch = () => {
    onToggle(video.id);
    setSheetOpen(false);
  };

  const handleGoToYouTube = () => {
    window.open(video.url, "_blank", "noopener,noreferrer");
    setSheetOpen(false);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: video.title, url: video.url });
      } catch (err) {
        console.error("공유 실패:", err);
      }
    } else {
      alert("이 브라우저에서는 공유 기능을 지원하지 않습니다.");
    }
    setSheetOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(video.url);
      alert("링크가 복사되었습니다.");
    } catch (err) {
      console.error("복사 실패:", err);
    }
    setSheetOpen(false);
  };

  const handleCategoryConfirm = (value: string) => {
    if (value === "auto") {
      onUpdateCategory(video.id, "auto");
    } else if (value === "none") {
      onUpdateCategory(video.id, null);
    } else {
      onUpdateCategory(video.id, value as Exclude<VideoCategory, "all">);
    }
  };

  return (
    <div className={`video-item${video.watched ? " watched" : ""}`}>
      <Checkbox.Root
        checked={video.watched}
        onCheckedChange={() => onToggle(video.id)}
        size="medium"
        style={{ flexShrink: 0 }}
      >
        <Checkbox.HiddenInput aria-label={`${video.title} 시청 완료`} />
        <Checkbox.Control>
          <Checkbox.Indicator checked={<IconCheckmarkLine />} />
        </Checkbox.Control>
      </Checkbox.Root>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
        {/* 1. 분류 상세 설정 (Chip 클릭 시) */}
        <BottomSheetRoot
          closeOnEscape
          closeOnInteractOutside
          open={categorySheetOpen}
          onOpenChange={setCategorySheetOpen}
        >
          <BottomSheetTrigger asChild>
            <Chip.Button
              variant={isOverridden ? "solid" : "outlineWeak"}
              size="small"
              style={{ flexShrink: 0 }}
            >
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

        {/* 2. 영상 옵션 메뉴 (제목 클릭 시) */}
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
              {video.title}
            </span>
          </MenuSheet.Trigger>
          <MenuSheet.Backdrop />
          <MenuSheet.Positioner>
            <MenuSheet.Content>
              <MenuSheet.Header>
                <MenuSheet.Title>{video.title}</MenuSheet.Title>
              </MenuSheet.Header>
              <MenuSheet.List>
                <MenuSheet.Group>
                  <MenuSheet.Item onClick={handleToggleWatch}>
                    <Icon svg={<IconCheckmarkLine />} size="20px" />
                    <MenuSheet.ItemContent>
                      <MenuSheet.ItemLabel>
                        {video.watched ? "시청 완료 취소" : "시청 완료 표시"}
                      </MenuSheet.ItemLabel>
                    </MenuSheet.ItemContent>
                  </MenuSheet.Item>
                </MenuSheet.Group>
                <MenuSheet.Group>
                  <MenuSheet.Item onClick={handleGoToYouTube}>
                    <Icon svg={<IconArrowUpRightLine />} size="20px" />
                    <MenuSheet.ItemContent>
                      <MenuSheet.ItemLabel>유튜브로 이동</MenuSheet.ItemLabel>
                    </MenuSheet.ItemContent>
                  </MenuSheet.Item>
                  <MenuSheet.Item onClick={handleShare}>
                    <Icon svg={<IconAndroidshareLine />} size="20px" />
                    <MenuSheet.ItemContent>
                      <MenuSheet.ItemLabel>공유하기</MenuSheet.ItemLabel>
                    </MenuSheet.ItemContent>
                  </MenuSheet.Item>
                  <MenuSheet.Item onClick={handleCopyLink}>
                    <Icon svg={<IconPaperclipLine />} size="20px" />
                    <MenuSheet.ItemContent>
                      <MenuSheet.ItemLabel>링크 복사</MenuSheet.ItemLabel>
                    </MenuSheet.ItemContent>
                  </MenuSheet.Item>
                </MenuSheet.Group>
              </MenuSheet.List>
              <MenuSheet.Footer>
                <MenuSheet.CloseButton asChild>
                  <ActionButton variant="neutralSolid" size="large" style={{ width: "100%" }}>
                    닫기
                  </ActionButton>
                </MenuSheet.CloseButton>
              </MenuSheet.Footer>
            </MenuSheet.Content>
          </MenuSheet.Positioner>
        </MenuSheet.Root>
      </div>
    </div>
  );
}

function CategorySheet({
  currentValue,
  onClose,
  onConfirm,
}: {
  currentValue: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}) {
  const [selected, setSelected] = useState(currentValue);

  return (
    <BottomSheetContent title="분류 상세 설정">
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
          <ActionButton
            flexGrow
            size="large"
            variant="neutralSolid"
            onClick={() => onConfirm(selected)}
          >
            완료
          </ActionButton>
        </HStack>
      </BottomSheetFooter>
    </BottomSheetContent>
  );
}
