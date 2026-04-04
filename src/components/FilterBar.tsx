"use client";

import { VideoCategory } from "@/lib/video-category";
import {
  ActionButton,
  TextFieldRoot,
  TextFieldInput,
  TextFieldPrefixIcon,
  Checkbox,
  Chip,
} from "@seed-design/react";
import { Cross2Icon, MagnifyingGlassIcon, CheckIcon } from "@radix-ui/react-icons";

type FilterType = "all" | "watched" | "unwatched";

const CATEGORY_FILTERS: { value: VideoCategory; label: string }[] = [
  { value: "all", label: "전체 분류" },
  { value: "story", label: "스토리" },
  { value: "music", label: "음악" },
  { value: "fesxlive", label: "FesxLIVE" },
  { value: "withxmeets", label: "With×MEETS" },
];

interface Props {
  filter: FilterType;
  category: VideoCategory;
  query: string;
  hidePrivateVideos: boolean;
  onFilterChange: (f: FilterType) => void;
  onCategoryChange: (category: VideoCategory) => void;
  onQueryChange: (q: string) => void;
  onHidePrivateVideosChange: (next: boolean) => void;
}

const FILTERS: { value: FilterType; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "unwatched", label: "미시청" },
  { value: "watched", label: "시청 완료" },
];

export default function FilterBar({
  filter,
  category,
  query,
  hidePrivateVideos,
  onFilterChange,
  onCategoryChange,
  onQueryChange,
  onHidePrivateVideosChange,
}: Props) {
  return (
    <div className="filter-section">
      {/* Filter Panel */}
      <div className="filter-panel">
        <div className="filter-rows">
          <div className="filter-row">
            <span className="filter-row-label">시청 상태</span>
            <div className="filter-btn-group" role="group" aria-label="시청 상태 필터">
              {FILTERS.map((f) => (
                <Chip.Root
                  key={f.value}
                  variant={filter === f.value ? "solid" : "outlineWeak"}
                  size="small"
                  onClick={() => onFilterChange(f.value)}
                >
                  <Chip.Label>{f.label}</Chip.Label>
                </Chip.Root>
              ))}
            </div>
          </div>

          <div className="filter-row">
            <span className="filter-row-label">분류</span>
            <div className="filter-btn-group" role="group" aria-label="카테고리 필터">
              {CATEGORY_FILTERS.map((item) => (
                <Chip.Root
                  key={item.value}
                  variant={category === item.value ? "solid" : "outlineWeak"}
                  size="small"
                  onClick={() => onCategoryChange(item.value)}
                >
                  <Chip.Label>{item.label}</Chip.Label>
                </Chip.Root>
              ))}
            </div>
          </div>
          <div className="filter-row">
            <span className="filter-row-label">옵션</span>
            <div className="filter-option">
              <Checkbox.Root
                checked={hidePrivateVideos}
                onCheckedChange={(checked) => onHidePrivateVideosChange(!!checked)}
                size="medium"
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control>
                  <Checkbox.Indicator checked={<CheckIcon />} />
                </Checkbox.Control>
                <Checkbox.Label
                  style={{ fontSize: "12px", color: "var(--seed-color-fg-neutral-subtle)", cursor: "pointer" }}
                >
                  Private 숨기기
                </Checkbox.Label>
              </Checkbox.Root>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar (Corrected to Seed Design Pattern) */}
      <TextFieldRoot
        value={query}
        onValueChange={onQueryChange}
        size="medium"
        className="search-field"
      >
        <TextFieldPrefixIcon svg={<MagnifyingGlassIcon />} />
        <TextFieldInput
          placeholder="제목 검색..."
          aria-label="영상 제목 검색"
        />
        {query && (
          <div className="search-clear-wrapper">
            <ActionButton
              variant="ghost"
              size="xsmall"
              onClick={() => onQueryChange("")}
              aria-label="검색어 지우기"
            >
              <Cross2Icon />
            </ActionButton>
          </div>
        )}
      </TextFieldRoot>
    </div>
  );
}
