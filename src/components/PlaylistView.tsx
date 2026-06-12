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
import { ensureLegacyBackup } from "@/lib/legacy-backup";
import type { CategoryOverrideValue } from "@/lib/storage";
import { ActionButton, Box, Icon, PullToRefresh, Text, TextFieldInput, TextFieldPrefixIcon, TextFieldRoot } from "@seed-design/react";
import { ProgressCircle } from "@/ui/progress-circle";
import { MenuRoot, MenuTrigger, MenuContent, MenuItem } from "@/ui/menu";
import { Callout, DismissibleCallout } from "@/ui/callout";
import type { AnnouncementBanner } from "@/lib/admin/announcements-types";
import Link from "next/link";
import { IconCheckmarkLine, IconChevronDownLine, IconExclamationmarkCircleFill, IconMagnifyingglassLine, IconSparkle2Fill, IconXmarkLine } from "@karrotmarket/react-monochrome-icon";
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
  /** 메인 배너에 노출할 최신 공지 (없으면 배너 미표시) */
  latestUpdate?: AnnouncementBanner | null;
}

export default function PlaylistView({ initialData, latestUpdate }: Props) {
  const { user, loading: authLoading } = useAuth();
  const { saveVideoProgress, mergeAllDevices, refreshDevices, requestAnonymousSync } = useProgressSync();
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

  const [selectedGeneration, setSelectedGeneration] = useState<string>("all");

  const generationSeasons = useMemo(
    () => selectedGeneration === "all" ? data.seasons : data.seasons.filter((s) => s.id.startsWith(selectedGeneration + "-")),
    [data.seasons, selectedGeneration]
  );

  const generationGroups = useMemo(() => {
    if (selectedGeneration !== "all") return null;
    const groups = new Map<string, PlaylistData["seasons"]>();
    for (const season of generationSeasons) {
      const gen = season.id.split("-")[0];
      if (!groups.has(gen)) groups.set(gen, []);
      groups.get(gen)!.push(season);
    }
    return [...groups.entries()];
  }, [generationSeasons, selectedGeneration]);

  const lastScrollY = useRef(0);
  const [scrolled, setScrolled] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>(null);
  const [compactSearchOpen, setCompactSearchOpen] = useState(false);
  const compactSearchRef = useRef<HTMLInputElement>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  // 업데이트 안내 배너 — 닫기는 이번 화면에서만 숨김(저장 안 함, 새로고침하면 다시 표시)
  const [updateBannerVisible, setUpdateBannerVisible] = useState(true);
  const { progressCategories, hidePrivateVideos, autoSync } = useSettings();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      // 어떤 코드 경로가 레거시 키를 재작성하기 전에 원본을 불변 백업해 둔다.
      ensureLegacyBackup();
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
                ...(overrideVal !== undefined ? { categoryOverride: overrideVal as CategoryOverrideValue } : {}),
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
  }, [authLoading, user, adapter]);

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
                  ? { categoryOverride: overrides[c.id] as CategoryOverrideValue }
                  : overrides[c.legacy_video_id] !== undefined
                    ? { categoryOverride: overrides[c.legacy_video_id] as CategoryOverrideValue }
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

  // 비파괴 재작성(하드 제약): 현재 카탈로그가 모르는 id(삭제된 콘텐츠, 아주 오래된
  // 데이터)는 기존 키에서 그대로 보존한다. 카탈로그가 아는 id만 현재 화면 상태로
  // 다시 쓴다. 원본은 ensureLegacyBackup이 이미 별도 키에 떠 둔 상태.
  const saveToLocalStorage = (nextData: PlaylistData) => {
    ensureLegacyBackup();
    const allContents = nextData.seasons.flatMap((s) => s.episodes.flatMap((ep) => ep.contents));
    const knownIds = new Set(allContents.flatMap((c) => [c.id, c.legacy_video_id]));

    let preservedWatched: string[] = [];
    let preservedOverrides: Record<string, string | null> = {};
    try {
      const prevWatched: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY_WATCHED) ?? "[]");
      preservedWatched = prevWatched.filter((id) => !knownIds.has(id));
      const prevOverrides: Record<string, string | null> = JSON.parse(
        localStorage.getItem(STORAGE_KEY_OVERRIDES) ?? "{}",
      );
      preservedOverrides = Object.fromEntries(
        Object.entries(prevOverrides).filter(([id]) => !knownIds.has(id)),
      );
    } catch {
      // 기존 키가 손상돼 있으면 보존할 수 없지만, 원본은 백업 키에 남아 있다.
    }

    const watchedIds = [
      ...allContents.filter((c) => c.watched).map((c) => c.id),
      ...preservedWatched,
    ];
    localStorage.setItem(STORAGE_KEY_WATCHED, JSON.stringify(watchedIds));

    const overrides: Record<string, string | null> = { ...preservedOverrides };
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

    if (user) {
      await saveVideoProgress(contentId, newStatus);
    } else {
      // 로컬 저장이 끝난 뒤 익명 세션을 만들어 Supabase(content.id)로도 저장.
      // 실패해도 기록은 이미 localStorage에 있다(legacy 폴백).
      requestAnonymousSync();
    }
  }

  function dismissUpdateBanner() {
    setUpdateBannerVisible(false);
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
                  <MenuRoot placement="bottom-start">
                    <MenuTrigger asChild>
                      <button className="generation-title-button compact-header-title">
                        {selectedGeneration === "all" ? "전체" : `${selectedGeneration}기`}
                        <Icon svg={<IconChevronDownLine />} size="16px" />
                      </button>
                    </MenuTrigger>
                    <MenuContent >
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
            <MenuRoot placement="bottom-start">
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
      <PlaylistProgress watched={stats.watched} total={stats.total} progressCategories={progressCategories} />

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
        <Box px="spacingX.globalGutter" mb="spacingY.componentDefault" role="status" aria-live="polite">
          <Text textStyle="t3Bold" color="fg.neutral">{filteredCount}편</Text>
          <Text textStyle="t3Regular" color="fg.neutralSubtle"> 표시 중</Text>
        </Box>
      )}

      {/* 업데이트 안내 배너 */}
      {updateBannerVisible && latestUpdate && (
        <div style={{ padding: "0 var(--seed-dimension-spacing-x-global-gutter)", marginBottom: "8px" }}>
          <DismissibleCallout
            tone="magic"
            prefixIcon={<IconSparkle2Fill />}
            title={latestUpdate.bannerTitle ?? latestUpdate.title}
            description={latestUpdate.summary}
            linkProps={{
              asChild: true,
              children: (
                <Link href={`/updates/${latestUpdate.slug}`}>자세히 보기</Link>
              ),
            }}
            onDismiss={dismissUpdateBanner}
          />
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
      {selectedGeneration === "all"
        ? (sortOrder === "newest" ? [...(generationGroups ?? [])].reverse() : (generationGroups ?? [])).map(([gen, seasons]) => {
            const orderedSeasons = sortOrder === "newest" ? [...seasons].reverse() : seasons;
            return (
              <div key={gen}>
                <h3 className="generation-heading">{gen}기</h3>
                {orderedSeasons.map((season) => (
                  <SeasonGroup
                    key={season.id}
                    season={season}
                    filter={filter}
                    categories={categories}
                    query={query}
                    sortOrder={sortOrder}
                    hidePrivateVideos={hidePrivateVideos}
                    onToggle={handleToggle}
                    headingLevel={4}
                  />
                ))}
              </div>
            );
          })
        : (sortOrder === "newest" ? [...generationSeasons].reverse() : generationSeasons).map((season) => (
            <SeasonGroup
              key={season.id}
              season={season}
              filter={filter}
              categories={categories}
              query={query}
              sortOrder={sortOrder}
              hidePrivateVideos={hidePrivateVideos}
              onToggle={handleToggle}
              headingLevel={4}
            />
          ))
      }
      </PullToRefresh.Content>
    </PullToRefresh.Root>
  );
}
