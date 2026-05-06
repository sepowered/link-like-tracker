"use client";

import { useState } from "react";
import { VideoCategory } from "@/lib/video-category";
import {
  ActionButton,
  Flex,
  HStack,
  Icon,
  Portal,
  TextFieldInput,
  TextFieldPrefixIcon,
  TextFieldRoot,
} from "@seed-design/react";
import {
  BottomSheetRoot,
  BottomSheetTrigger,
  BottomSheetContent,
  BottomSheetBody,
  BottomSheetFooter,
} from "@/ui/bottom-sheet";
import { Chip } from "@/ui/chip";
import { Snackbar, useSnackbarAdapter } from "@/ui/snackbar";
import {
  IconChevronDownFill,
  IconMagnifyingglassLine,
  IconXmarkLine,
} from "@karrotmarket/react-monochrome-icon";

type FilterType = "all" | "watched" | "unwatched";
type SheetType = "watch" | "category";

const FILTERS: { value: FilterType; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "unwatched", label: "미시청" },
  { value: "watched", label: "시청 완료" },
];

const CATEGORY_FILTERS: { value: VideoCategory; label: string }[] = [
  { value: "all", label: "전체 분류" },
  { value: "story", label: "스토리" },
  { value: "music", label: "음악" },
  { value: "fesxlive", label: "FesxLIVE" },
  { value: "fesxrec", label: "FesxReC" },
  { value: "withxmeets", label: "With×MEETS" },
];

interface Props {
  filter: FilterType;
  categories: VideoCategory[];
  query: string;
  sortOrder: "newest" | "oldest";
  onFilterChange: (f: FilterType) => void;
  onCategoriesChange: (categories: VideoCategory[]) => void;
  onQueryChange: (q: string) => void;
  onSortOrderChange: (order: "newest" | "oldest") => void;
}

export default function FilterBar({
  filter,
  categories,
  query,
  sortOrder,
  onFilterChange,
  onCategoriesChange,
  onQueryChange,
  onSortOrderChange,
}: Props) {
  const [openSheet, setOpenSheet] = useState<SheetType | null>(null);
  const adapter = useSnackbarAdapter();

  function handleSortToggle() {
    const next = sortOrder === "newest" ? "oldest" : "newest";
    onSortOrderChange(next);
    adapter.create({
      render: () => (
        <Snackbar message={next === "newest" ? "최신순으로 정렬했어요" : "과거순으로 정렬했어요"} />
      ),
    });
  }

  const currentFilterLabel = filter === "all" ? "시청 상태" : FILTERS.find((f) => f.value === filter)?.label ?? "시청 상태";
  
  let currentCategoryLabel = "전체 분류";
  if (!categories.includes("all") && categories.length > 0) {
    const firstLabel = CATEGORY_FILTERS.find((c) => c.value === categories[0])?.label ?? "";
    currentCategoryLabel = categories.length > 1 ? `${firstLabel} 외 ${categories.length - 1}개` : firstLabel;
  }

  return (
    <div className="filter-section">
      <Flex gap="spacingX.betweenChips" overflowX="auto" align="center" className="filter-bar">
        {/* 시청 상태 */}
        <BottomSheetRoot
          closeOnEscape
          closeOnInteractOutside
          open={openSheet === "watch"}
          onOpenChange={(open) => setOpenSheet(open ? "watch" : null)}
        >
          <BottomSheetTrigger asChild>
            <Chip.Button variant="solid" size="large">
              <Chip.Label>{currentFilterLabel}</Chip.Label>
              <Chip.SuffixIcon>
                <Icon svg={<IconChevronDownFill />} size="14px" />
              </Chip.SuffixIcon>
            </Chip.Button>
          </BottomSheetTrigger>
          <Portal>
            <WatchFilterSheet
              currentFilter={filter}
              onClose={() => setOpenSheet(null)}
              onConfirm={onFilterChange}
            />
          </Portal>
        </BottomSheetRoot>

        {/* 분류 */}
        <BottomSheetRoot
          closeOnEscape
          closeOnInteractOutside
          open={openSheet === "category"}
          onOpenChange={(open) => setOpenSheet(open ? "category" : null)}
        >
          <BottomSheetTrigger asChild>
            <Chip.Button variant="solid" size="large">
              <Chip.Label>{currentCategoryLabel}</Chip.Label>
              <Chip.SuffixIcon>
                <Icon svg={<IconChevronDownFill />} size="14px" />
              </Chip.SuffixIcon>
            </Chip.Button>
          </BottomSheetTrigger>
          <Portal>
            <CategoryFilterSheet
              currentCategories={categories}
              onClose={() => setOpenSheet(null)}
              onConfirm={onCategoriesChange}
            />
          </Portal>
        </BottomSheetRoot>

        <Chip.Button
          size="large"
          variant="solid"
          onClick={handleSortToggle}
        >
          <Chip.Label>{sortOrder === "newest" ? "최신순" : "과거순"}</Chip.Label>
        </Chip.Button>

      </Flex>

      {/* 검색 */}
      <TextFieldRoot
        value={query}
        onValueChange={onQueryChange}
        size="medium"
        className="search-field"
      >
        <TextFieldPrefixIcon svg={<IconMagnifyingglassLine />} />
        <TextFieldInput placeholder="제목 검색..." aria-label="영상 제목 검색" />
        {query && (
          <div className="search-clear-wrapper">
            <ActionButton
              variant="ghost"
              size="xsmall"
              onClick={() => onQueryChange("")}
              aria-label="검색어 지우기"
            >
              <Icon svg={<IconXmarkLine />} size="16px" />
            </ActionButton>
          </div>
        )}
      </TextFieldRoot>
    </div>
  );
}

function WatchFilterSheet({
  currentFilter,
  onClose,
  onConfirm,
}: {
  currentFilter: FilterType;
  onClose: () => void;
  onConfirm: (value: FilterType) => void;
}) {
  const [selected, setSelected] = useState<FilterType>(currentFilter);

  return (
    <BottomSheetContent title="시청 상태" aria-describedby={undefined} style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}>
      <BottomSheetBody>
        <HStack gap="x2" wrap>
          {FILTERS.map((f) => (
            <Chip.Toggle
              key={f.value}
              variant="outlineStrong"
              size="medium"
              checked={selected === f.value}
              onCheckedChange={(checked) => {
                if (checked) setSelected(f.value);
              }}
            >
              <Chip.Label>{f.label}</Chip.Label>
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
            onClick={() => {
              onConfirm(selected);
              onClose();
            }}
          >
            완료
          </ActionButton>
        </HStack>
      </BottomSheetFooter>
    </BottomSheetContent>
  );
}

function CategoryFilterSheet({
  currentCategories,
  onClose,
  onConfirm,
}: {
  currentCategories: VideoCategory[];
  onClose: () => void;
  onConfirm: (values: VideoCategory[]) => void;
}) {
  const [selected, setSelected] = useState<VideoCategory[]>(currentCategories);

  const handleToggle = (value: VideoCategory, checked: boolean) => {
    if (value === "all") {
      if (checked) setSelected(["all"]);
    } else {
      setSelected((prev) => {
        let next = prev.filter((v) => v !== "all");
        if (checked) {
          if (!next.includes(value)) next.push(value);
        } else {
          next = next.filter((v) => v !== value);
        }
        if (next.length === 0) return ["all"];
        return next;
      });
    }
  };

  return (
    <BottomSheetContent title="분류" aria-describedby={undefined} style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}>
      <BottomSheetBody>
        <HStack gap="x2" wrap>
          {CATEGORY_FILTERS.map((item) => (
            <Chip.Toggle
              key={item.value}
              variant="outlineStrong"
              size="medium"
              checked={selected.includes(item.value)}
              onCheckedChange={(checked) => handleToggle(item.value, checked)}
            >
              <Chip.Label>{item.label}</Chip.Label>
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
            onClick={() => {
              onConfirm(selected);
              onClose();
            }}
          >
            완료
          </ActionButton>
        </HStack>
      </BottomSheetFooter>
    </BottomSheetContent>
  );
}
