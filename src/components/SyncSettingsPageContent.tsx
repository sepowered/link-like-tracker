"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useProgressSync } from "@/providers/ProgressSyncProvider";
import PageHeader from "@/components/PageHeader";
import { ActionButton, HStack, Icon, VStack } from "@seed-design/react";
import { List, ListItem } from "@/ui/list";
import { ListHeader } from "@/ui/list-header";
import { Snackbar, useSnackbarAdapter } from "@/ui/snackbar";
import {
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetRoot,
} from "@/ui/bottom-sheet";
import {
  IconPersonCircleLine,
  IconTrashcanLine,
} from "@karrotmarket/react-monochrome-icon";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  fetchDeviceProgressStats,
  type DeviceProgressStats,
} from "@/lib/supabase-progress";
import playlistData from "@/../data/playlist.json";

const videoTitleMap = new Map<string, string>();
for (const season of playlistData.seasons) {
  for (const video of season.videos) {
    videoTitleMap.set(video.id, video.title);
  }
}
const totalVideos = videoTitleMap.size;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export default function SyncSettingsPageContent() {
  const { user } = useAuth();
  const {
    devices,
    devicesLoading,
    currentDeviceId,
    syncing,
    deleteDevice,
    adoptDeviceProgress,
  } = useProgressSync();
  const adapter = useSnackbarAdapter();

  const [stats, setStats] = useState<Map<string, DeviceProgressStats>>(new Map());
  const [statsLoading, setStatsLoading] = useState(false);
  const [adoptTarget, setAdoptTarget] = useState<{ deviceId: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ deviceId: string; name: string } | null>(null);

  useEffect(() => {
    if (!user || devices.length === 0) return;
    setStatsLoading(true);
    const supabase = getSupabaseBrowserClient();
    fetchDeviceProgressStats(supabase, user.id)
      .then(setStats)
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, [user, devices]);

  function getDeviceName(deviceId: string, deviceName: string | null): string {
    return deviceName ?? `기기 ${deviceId.slice(0, 8)}`;
  }

  function getDetailText(deviceId: string): string {
    if (statsLoading) return "기록을 불러오고 있어요.";
    const s = stats.get(deviceId);
    const watched = s?.watchedCount ?? 0;
    if (!s || watched === 0) return `0 / ${totalVideos}개 시청 · 아직 시청 기록이 없어요.`;
    const lastTitle = s.lastWatchedVideoId ? videoTitleMap.get(s.lastWatchedVideoId) ?? "알 수 없음" : null;
    const lastDate = s.lastWatchedAt ? formatDate(s.lastWatchedAt) : "";
    const lastPart = lastTitle ? `${lastTitle} (${lastDate})` : lastDate;
    return `${watched} / ${totalVideos}개 시청 · 마지막: ${lastPart}`;
  }

  async function handleAdoptConfirm() {
    if (!adoptTarget) return;
    const { deviceId, name } = adoptTarget;
    setAdoptTarget(null);
    try {
      await adoptDeviceProgress(deviceId);
      adapter.create({
        render: () => <Snackbar variant="positive" message={`${name}의 기록으로 맞췄어요.`} />,
      });
    } catch {
      adapter.create({
        render: () => <Snackbar variant="critical" message="기록을 맞추지 못했어요. 다시 시도해요." />,
      });
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const { deviceId } = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteDevice(deviceId);
      adapter.create({
        render: () => <Snackbar variant="positive" message="기기 기록을 삭제했어요." />,
      });
    } catch {
      adapter.create({
        render: () => <Snackbar variant="critical" message="삭제하지 못했어요. 다시 시도해요." />,
      });
    }
  }

  return (
    <div className="settings-page">
      <PageHeader title="기기 및 동기화" borderBottom={false} />

      {!user ? (
        <VStack gap="x3">
          <ListHeader as="h2">계정</ListHeader>
          <List>
            <ListItem
              title="로그인이 필요해요."
              detail="Google로 로그인하면 기기별 시청 기록을 동기화할 수 있어요."
              prefix={<Icon svg={<IconPersonCircleLine />} size="32px" />}
            />
          </List>
        </VStack>
      ) : (
        <VStack gap="x3">
          <ListHeader as="h2">기기 목록</ListHeader>
          <List>
            {devicesLoading ? (
              <ListItem title="기기 목록을 불러오고 있어요." />
            ) : devices.length === 0 ? (
              <ListItem
                title="연결된 기기가 없어요."
                detail="기록을 동기화하면 이곳에 기기가 표시돼요."
              />
            ) : (
              devices.map((device) => {
                const isCurrent = device.device_id === currentDeviceId;
                const name = getDeviceName(device.device_id, device.device_name);

                return (
                  <ListItem
                    key={device.device_id}
                    alignItems="flex-start"
                    title={isCurrent ? `${name} (현재 기기)` : name}
                    detail={getDetailText(device.device_id)}
                    suffix={
                      <HStack gap="x1">
                        <ActionButton
                          variant="neutralWeak"
                          size="small"
                          disabled={syncing}
                          onClick={() => setAdoptTarget({ deviceId: device.device_id, name })}
                        >
                          이 기기로 맞추기
                        </ActionButton>
                        {!isCurrent && (
                          <ActionButton
                            variant="ghost"
                            size="small"
                            layout="iconOnly"
                            aria-label="기기 삭제"
                            disabled={syncing}
                            onClick={() => setDeleteTarget({ deviceId: device.device_id, name })}
                          >
                            <Icon svg={<IconTrashcanLine />} />
                          </ActionButton>
                        )}
                      </HStack>
                    }
                  />
                );
              })
            )}
          </List>
        </VStack>
      )}

      <BottomSheetRoot
        open={!!adoptTarget}
        onOpenChange={(open) => { if (!open) setAdoptTarget(null); }}
        closeOnEscape
        closeOnInteractOutside
      >
        <BottomSheetContent
          title={`${adoptTarget?.name ?? ""}의 기록으로 맞출까요?`}
          description="모든 기기의 시청 기록이 이 기기의 기록으로 바뀌어요."
          showCloseButton
          style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}
        >
          <BottomSheetFooter>
            <ActionButton
              variant="neutralSolid"
              size="large"
              disabled={syncing}
              loading={syncing}
              style={{ width: "100%" }}
              onClick={handleAdoptConfirm}
            >
              이 기기 기록으로 맞추기
            </ActionButton>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheetRoot>

      <BottomSheetRoot
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        closeOnEscape
        closeOnInteractOutside
      >
        <BottomSheetContent
          title={`${deleteTarget?.name ?? ""}의 기록을 삭제할까요?`}
          description="이 기기의 동기화 기록이 삭제돼요. 되돌릴 수 없어요."
          showCloseButton
          style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}
        >
          <BottomSheetFooter>
            <ActionButton
              variant="criticalSolid"
              size="large"
              disabled={syncing}
              style={{ width: "100%" }}
              onClick={handleDeleteConfirm}
            >
              삭제하기
            </ActionButton>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheetRoot>
    </div>
  );
}
