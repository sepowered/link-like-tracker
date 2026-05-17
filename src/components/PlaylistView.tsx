"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { PlaylistData } from "@/types";
import { VideoCategory } from "@/lib/video-category";
import { useSettings } from "./SettingsProvider";
import SeasonGroup from "./SeasonGroup";
import FilterBar from "./FilterBar";
import SettingsLink from "./SettingsLink";
import PlaylistProgress from "./PlaylistProgress";
import AppBar from "./AppBar";
import { useAuth } from "@/providers/AuthProvider";
import { SYNC_EVENT, useProgressSync } from "@/providers/ProgressSyncProvider";
import { ActionButton, Icon, PullToRefresh, TextFieldInput, TextFieldPrefixIcon, TextFieldRoot } from "@seed-design/react";
import { ProgressCircle } from "@/ui/progress-circle";
import { MenuRoot, MenuTrigger, MenuContent, MenuItem } from "@/ui/menu";
import { Callout } from "@/ui/callout";
import Link from "next/link";
import { IconCheckmarkLine, IconChevronDownLine, IconExclamationmarkCircleFill, IconMagnifyingglassLine, IconXmarkLine } from "@karrotmarket/react-monochrome-icon";
import { Snackbar, useSnackbarAdapter } from "@/ui/snackbar";

type FilterType = "all" | "watched" | "unwatched";
type ScrollDirection = "up" | "down" | null;

const STORAGE_KEY_WATCHED = "llt-watched";
const STORAGE_KEY_OVERRIDES = "llt-overrides";
const STORAGE_KEY_FILTERS = "llt-filters";
const STICKY_SCROLL_THRESHOLD = 60;
const SCROLL_DIRECTION_DELTA = 6;

interface Props {
  initialData: PlaylistData;
}

export default function PlaylistView({ initialData }: Props) {
  const { user, loading: authLoading } = useAuth();
  const { saveVideoProgress, mergeAllDevices, refreshDevices } = useProgressSync();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const adapter = useSnackbarAdapter();
  const sessionSnackbarShown = useRef(false);
  const [data, setData] = useState<PlaylistData>(initialData);
  const [filter, setFilter] = useState<FilterType>("all");
  const [categories, setCategories] = useState<VideoCategory[]>(["all"]);
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  const generations = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const season of data.seasons) {
      const gen = season.id.split("-")[0];
      if (!seen.has(gen)) { seen.add(gen); result.push(gen); }
    }
    return result;
  }, [data.seasons]);

  const [selectedGeneration, setSelectedGeneration] = useState<string>(
    () => {
      const seen = new Set<string>();
      for (const s of initialData.seasons) seen.add(s.id.split("-")[0]);
      const arr = [...seen];
      return arr[arr.length - 1] ?? "";
    }
  );

  const generationSeasons = useMemo(
    () => selectedGeneration === "all" ? data.seasons : data.seasons.filter((s) => s.id.startsWith(selectedGeneration + "-")),
    [data.seasons, selectedGeneration]
  );

  const lastScrollY = useRef(0);
  const [scrolled, setScrolled] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>(null);
  const [compactSearchOpen, setCompactSearchOpen] = useState(false);
  const compactSearchRef = useRef<HTMLInputElement>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const { progressCategories, hidePrivateVideos, autoSync } = useSettings();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const watchedIdsRaw = localStorage.getItem(STORAGE_KEY_WATCHED);
      const overridesRaw = localStorage.getItem(STORAGE_KEY_OVERRIDES);
      const filtersRaw = localStorage.getItem(STORAGE_KEY_FILTERS);

      // Support both legacy YouTube IDs and new content IDs
      const watchedIds: string[] = watchedIdsRaw ? JSON.parse(watchedIdsRaw) : [];
      const overrides: Record<string, string | null> = overridesRaw ? JSON.parse(overridesRaw) : {};

      setData((prev) => ({
        seasons: prev.seasons.map((season) => ({
          ...season,
          episodes: season.episodes.map((ep) => ({
            ...ep,
            contents: ep.contents.map((c) => {
              const isWatched =
                watchedIds.includes(c.id) || watchedIds.includes(c.legacy_video_id);
              const overrideVal = overrides[c.id] ?? overrides[c.legacy_video_id];
              return {
                ...c,
                watched: isWatched || c.watched,
                ...(overrideVal !== undefined ? { categoryOverride: overrideVal as any } : {}),
              };
            }),
          })),
        })),
      }));

      if (filtersRaw) {
        const saved = JSON.parse(filtersRaw);
        if (saved.filter) setFilter(saved.filter);
        if (saved.categories) setCategories(saved.categories);
        if (saved.sortOrder) setSortOrder(saved.sortOrder);
      }
    } catch (e) {
      console.error("Failed to load local storage", e);
    } finally {
      setIsInitialized(true);
      setFiltersInitialized(true);
    }
  }, []);

  // Show login snackbar once when session is first detected
  useEffect(() => {
    if (authLoading || !user?.email || sessionSnackbarShown.current) return;
    sessionSnackbarShown.current = true;
    adapter.create({
      render: () => <Snackbar message={`${user.email} 계정으로 로그인했어요.`} />,
    });
  }, [authLoading, user]);

  // Re-apply progress from localStorage when ProgressSyncProvider resolves a conflict
  useEffect(() => {
    function handleProgressSync() {
      try {
        const watchedIdsRaw = localStorage.getItem(STORAGE_KEY_WATCHED);
        const overridesRaw = localStorage.getItem(STORAGE_KEY_OVERRIDES);
        const watchedIds: string[] = watchedIdsRaw ? JSON.parse(watchedIdsRaw) : [];
        const overrides: Record<string, string | null> = overridesRaw ? JSON.parse(overridesRaw) : {};
        setData((prev) => ({
          seasons: prev.seasons.map((season) => ({
            ...season,
            episodes: season.episodes.map((ep) => ({
              ...ep,
              contents: ep.contents.map((c) => ({
                ...c,
                watched: watchedIds.includes(c.id) || watchedIds.includes(c.legacy_video_id),
                ...(overrides[c.id] !== undefined
                  ? { categoryOverride: overrides[c.id] as any }
                  : overrides[c.legacy_video_id] !== undefined
                    ? { categoryOverride: overrides[c.legacy_video_id] as any }
                    : {}),
              })),
            })),
          })),
        }));
      } catch {}
    }
    window.addEventListener(SYNC_EVENT, handleProgressSync);
    return () => window.removeEventListener(SYNC_EVENT, handleProgressSync);
  }, []);

  // Save filter state to localStorage
  useEffect(() => {
    if (!filtersInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify({ filter, categories, sortOrder }));
    } catch (e) {
      console.error("Failed to save filters to localStorage", e);
    }
  }, [filter, categories, sortOrder, filtersInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const currentY = el.scrollTop;
      if (currentY <= STICKY_SCROLL_THRESHOLD) {
        lastScrollY.current = currentY;
        setScrolled(false);
        setScrollDirection(null);
        return;
      }
      const delta = currentY - lastScrollY.current;
      if (Math.abs(delta) < SCROLL_DIRECTION_DELTA) return;
      setScrolled(true);
      setScrollDirection(delta > 0 ? "down" : "up");
      lastScrollY.current = currentY;
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [isInitialized]);

  const saveToLocalStorage = (nextData: PlaylistData) => {
    const allContents = nextData.seasons.flatMap((s) => s.episodes.flatMap((ep) => ep.contents));

    const watchedIds = allContents.filter((c) => c.watched).map((c) => c.id);
    localStorage.setItem(STORAGE_KEY_WATCHED, JSON.stringify(watchedIds));

    const overrides: Record<string, any> = {};
    allContents.forEach((c) => {
      if (c.categoryOverride !== undefined) overrides[c.id] = c.categoryOverride;
    });
    localStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(overrides));
  };

  const stats = useMemo(() => {
    const allContents = generationSeasons.flatMap((s) => s.episodes.flatMap((ep) => ep.contents));
    const targetContents =
      progressCategories.length === 0
        ? allContents
        : allContents.filter((c) => {
            const effectiveCategory = c.categoryOverride !== undefined ? c.categoryOverride : c.type;
            return progressCategories.includes(effectiveCategory as VideoCategory);
          });
    return {
      total: targetContents.length,
      watched: targetContents.filter((c) => c.watched).length,
    };
  }, [generationSeasons, progressCategories]);

  const filteredCount = useMemo(() => {
    return generationSeasons.reduce((total, season) => {
      return total + season.episodes.reduce((epTotal, ep) => {
        return epTotal + ep.contents.filter((c) => {
          if (filter === "watched" && !c.watched) return false;
          if (filter === "unwatched" && c.watched) return false;
          if (hidePrivateVideos && c.type === "unavailable") return false;
          if (query) {
            const q = query.toLowerCase();
            const inTitle =
              (c.title_ko ?? "").toLowerCase().includes(q) ||
              (c.title_jp ?? "").toLowerCase().includes(q) ||
              (c.part_label ?? "").toLowerCase().includes(q);
            if (!inTitle) return false;
          }
          if (!categories.includes("all")) {
            const effectiveCategory = c.categoryOverride !== undefined ? c.categoryOverride : c.type;
            if (!categories.includes(effectiveCategory as VideoCategory)) return false;
          }
          return true;
        }).length;
      }, 0);
    }, 0);
  }, [generationSeasons, filter, categories, query, hidePrivateVideos]);

  const isFiltered = filter !== "all" || !categories.includes("all") || query !== "";

  async function handleToggle(contentId: string) {
    const allContents = data.seasons.flatMap((s) => s.episodes.flatMap((ep) => ep.contents));
    const current = allContents.find((c) => c.id === contentId);
    const newStatus = current?.watched ? "unwatched" : "watched";

    setData((prev) => {
      const next: PlaylistData = {
        seasons: prev.seasons.map((season) => ({
          ...season,
          episodes: season.episodes.map((ep) => ({
            ...ep,
            contents: ep.contents.map((c) =>
              c.id === contentId ? { ...c, watched: !c.watched } : c
            ),
          })),
        })),
      };
      if (!user) saveToLocalStorage(next);
      return next;
    });

    if (user) await saveVideoProgress(contentId, newStatus);
  }

  async function handleUpdateCategory(
    contentId: string,
    categoryOverride: "story" | "music" | "fesxlive" | "fesxrec" | "withxmeets" | null | "auto"
  ) {
    const allContents = data.seasons.flatMap((s) => s.episodes.flatMap((ep) => ep.contents));
    const current = allContents.find((c) => c.id === contentId);
    const currentStatus = current?.watched ? "watched" : "unwatched";

    setData((prev) => {
      const next: PlaylistData = {
        seasons: prev.seasons.map((season) => ({
          ...season,
          episodes: season.episodes.map((ep) => ({
            ...ep,
            contents: ep.contents.map((c) => {
              if (c.id !== contentId) return c;
              if (categoryOverride === "auto") {
                const { categoryOverride: _, ...rest } = c;
                return rest;
              }
              return { ...c, categoryOverride };
            }),
          })),
        })),
      };
      if (!user) saveToLocalStorage(next);
      return next;
    });

    if (user) await saveVideoProgress(contentId, currentStatus, categoryOverride);
  }

  async function handlePtrRefresh() {
    try {
      const changed = await mergeAllDevices("latest");
      await refreshDevices();
      adapter.create({
        render: () => (
          <Snackbar
            variant="positive"
            message={changed ? "기록을 동기화했어요." : "이미 최신 상태예요."}
          />
        ),
      });
    } catch {
      adapter.create({ render: () => <Snackbar variant="critical" message="동기화에 실패했어요. 다시 시도해 주세요." /> });
    }
  }

  const showCompactHeader = scrolled;
  const showStickyFilter = scrolled && scrollDirection === "up" && !compactSearchOpen;
  const showCompactBar = showCompactHeader;
  const ptrEnabled = Boolean(user && autoSync);

  if (!isInitialized) return null;

  return (
    <PullToRefresh.Root
      ref={scrollContainerRef}
      disabled={!ptrEnabled}
      onPtrRefresh={handlePtrRefresh}
      style={{ height: "100dvh", overflowY: "auto" }}
    >
      {ptrEnabled ? (
        <PullToRefresh.Indicator
          style={{ top: "calc(var(--seed-safe-area-top) + var(--seed-dimension-x4))" }}
        >
          {({ value, minValue, maxValue }) => (
            <ProgressCircle
              value={value}
              minValue={minValue}
              maxValue={maxValue}
              size="24"
              tone="neutral"
              style={{ opacity: value === undefined || value > 0 ? 1 : 0 }}
            />
          )}
        </PullToRefresh.Indicator>
      ) : null}

      <PullToRefresh.Content>
      {/* 컴팩트 스티키 헤더 */}
      <div className={`compact-bar-wrapper${showCompactBar ? " compact-bar-wrapper--visible" : ""}`}>
        {showCompactHeader ? (
          <div className="compact-header">
            {compactSearchOpen ? (
              <>
                <TextFieldRoot
                  value={query}
                  onValueChange={setQuery}
                  size="medium"
                  style={{ flex: 1 }}
                >
                  <TextFieldPrefixIcon svg={<IconMagnifyingglassLine />} />
                  <TextFieldInput
                    ref={compactSearchRef}
                    placeholder="제목 검색..."
                    aria-label="콘텐츠 제목 검색"
                    onKeyDown={(e) => { if (e.key === "Escape") { setQuery(""); setCompactSearchOpen(false); } }}
                  />
                </TextFieldRoot>
                <ActionButton
                  variant="ghost"
                  size="small"
                  aria-label="검색 닫기"
                  style={{ marginLeft: "4px", flexShrink: 0 }}
                  onClick={() => { setQuery(""); setCompactSearchOpen(false); }}
                >
                  <Icon svg={<IconXmarkLine />} size="22px" />
                </ActionButton>
              </>
            ) : (
              <>
                {generations.length > 1 ? (
                  <MenuRoot>
                    <MenuTrigger asChild>
                      <button className="generation-title-button compact-header-title">
                        {selectedGeneration === "all" ? "전체" : `${selectedGeneration}기`}
                        <Icon svg={<IconChevronDownLine />} size="16px" />
                      </button>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem
                        label="전체"
                        suffixIcon={selectedGeneration === "all" ? <IconCheckmarkLine /> : undefined}
                        onClick={() => setSelectedGeneration("all")}
                      />
                      {generations.map((gen) => (
                        <MenuItem
                          key={gen}
                          label={`${gen}기`}
                          suffixIcon={selectedGeneration === gen ? <IconCheckmarkLine /> : undefined}
                          onClick={() => setSelectedGeneration(gen)}
                        />
                      ))}
                    </MenuContent>
                  </MenuRoot>
                ) : (
                  <span className="compact-header-title">
                    {selectedGeneration === "all" ? "전체" : `${selectedGeneration}기`}
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <ActionButton
                    variant="ghost"
                    size="small"
                    aria-label="검색"
                    onClick={() => {
                      setCompactSearchOpen(true);
                      setTimeout(() => compactSearchRef.current?.focus(), 50);
                    }}
                  >
                    <Icon svg={<IconMagnifyingglassLine />} size="22px" />
                  </ActionButton>
                  <SettingsLink />
                </div>
              </>
            )}
          </div>
        ) : null}
        <div className={`compact-sticky-filter${showStickyFilter ? " compact-sticky-filter--visible" : ""}`}>
          <FilterBar
            filter={filter}
            categories={categories}
            query={query}
            sortOrder={sortOrder}
            onFilterChange={setFilter}
            onCategoriesChange={setCategories}
            onQueryChange={setQuery}
            onSortOrderChange={setSortOrder}
            hideSearch
          />
        </div>
      </div>

      {/* 헤더 */}
      <AppBar
        variant="home"
        title="lltracker"
        leftSlot={
          generations.length > 1 ? (
            <MenuRoot>
              <MenuTrigger asChild>
                <button className="generation-title-button">
                  {selectedGeneration === "all" ? "전체" : `${selectedGeneration}기`}
                  <Icon svg={<IconChevronDownLine />} size="18px" />
                </button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem
                  label="전체"
                  suffixIcon={selectedGeneration === "all" ? <IconCheckmarkLine /> : undefined}
                  onClick={() => setSelectedGeneration("all")}
                />
                {generations.map((gen) => (
                  <MenuItem
                    key={gen}
                    label={`${gen}기`}
                    suffixIcon={selectedGeneration === gen ? <IconCheckmarkLine /> : undefined}
                    onClick={() => setSelectedGeneration(gen)}
                  />
                ))}
              </MenuContent>
            </MenuRoot>
          ) : undefined
        }
        rightSlot={<SettingsLink />}
      />

      {/* 전체 진행률 */}
      <PlaylistProgress watched={stats.watched} total={stats.total} />

      {/* 필터 + 검색 */}
      <FilterBar
        filter={filter}
        categories={categories}
        query={query}
        sortOrder={sortOrder}
        onFilterChange={setFilter}
        onCategoriesChange={setCategories}
        onQueryChange={setQuery}
        onSortOrderChange={setSortOrder}
      />

      {/* 필터 결과 피드백 */}
      {isFiltered && (
        <div className="filter-result-bar" role="status" aria-live="polite">
          <span className="filter-result-count">{filteredCount}편</span>
          <span className="filter-result-label"> 표시 중</span>
        </div>
      )}

      {/* 추가 요청 배너 */}
      <div style={{ padding: "0 var(--seed-dimension-spacing-x-global-gutter)", marginBottom: "8px" }}>
        <Callout
          tone="informative"
          prefixIcon={<IconExclamationmarkCircleFill />}
          description="아직 추가되지 않은 스토리 및 콘텐츠가 있나요?"
          linkProps={{
            asChild: true,
            children: <Link href="/add-request">추가 요청하기</Link>,
          }}
        />
      </div>

      {/* 시즌별 그룹 */}
      {(sortOrder === "newest" ? [...generationSeasons].reverse() : generationSeasons).map((season) => (
        <SeasonGroup
          key={season.id}
          season={season}
          filter={filter}
          categories={categories}
          query={query}
          sortOrder={sortOrder}
          hidePrivateVideos={hidePrivateVideos}
          onToggle={handleToggle}
          onUpdateCategory={handleUpdateCategory}
        />
      ))}
      </PullToRefresh.Content>
    </PullToRefresh.Root>
  );
}
