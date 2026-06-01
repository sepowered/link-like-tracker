"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useSettings } from "@/components/SettingsProvider";
import { useProgressSync } from "@/providers/ProgressSyncProvider";
import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { ActionButton, HStack, Icon, Text, VStack } from "@seed-design/react";
import { List, ListItem, ListButtonItem, ListSwitchItem } from "@/ui/list";
import { Switchmark } from "@/ui/switch";
import { ListHeader } from "@/ui/list-header";
import { Snackbar, useSnackbarAdapter } from "@/ui/snackbar";
import {
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetRoot,
} from "@/ui/bottom-sheet";
import { Checkbox, CheckboxGroup } from "@/ui/checkbox";
import { IconTrashcanLine } from "@karrotmarket/react-monochrome-icon";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { getAuthCallbackUrl } from "@/lib/auth-redirect-url";
import {
  fetchDeviceProgressStats,
  type DeviceProgressStats,
} from "@/lib/supabase-progress";
import playlistData from "../../data/playlist.initial.json";

const videoTitleMap = new Map<string, string>();
for (const season of (playlistData as any).seasons) {
  for (const episode of season.episodes) {
    for (const content of episode.contents) {
      const title = content.title_jp ?? content.title_ko ?? content.part_label ?? episode.title_ko ?? "";
      videoTitleMap.set(content.id, title);
    }
  }
}
const totalVideos = videoTitleMap.size;

const GOOGLE_LOGO = (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" />
  </svg>
);

const INITIAL_CONSENT = { privacy: false, overseasTransfer: false, ageOver14: false };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export default function SyncSettingsPageContent() {
  const { user } = useAuth();
  const { autoSync, setAutoSync } = useSettings();
  const [loginConsent, setLoginConsent] = useState(INITIAL_CONSENT);
  const [loginLoading, setLoginLoading] = useState(false);
  const allLoginConsentChecked = Object.values(loginConsent).every(Boolean);
  const {
    devices,
    devicesLoading,
    currentDeviceId,
    syncing,
    deleteDevice,
    adoptDeviceProgress,
    mergeAllDevices,
  } = useProgressSync();
  const adapter = useSnackbarAdapter();

  const [stats, setStats] = useState<Map<string, DeviceProgressStats>>(new Map());
  const [statsLoading, setStatsLoading] = useState(false);
  const [adoptTarget, setAdoptTarget] = useState<{ deviceId: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ deviceId: string; name: string } | null>(null);

  function handleLoginConsentChange(key: keyof typeof INITIAL_CONSENT, checked: boolean) {
    setLoginConsent((prev) => ({ ...prev, [key]: checked }));
  }

  async function handleGoogleSignIn() {
    if (!allLoginConsentChecked || loginLoading) return;
    setLoginLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getAuthCallbackUrl() },
    });
    if (error) {
      setLoginLoading(false);
      adapter.create({
        render: () => <Snackbar variant="critical" message="Google 로그인 연결에 실패했어요." />,
      });
    }
  }

  async function handleManualSync() {
    try {
      const changed = await mergeAllDevices();
      adapter.create({
        render: () => (
          <Snackbar
            variant="positive"
            message={changed ? "기록을 동기화했어요." : "이미 최신 상태예요."}
          />
        ),
      });
    } catch {
      adapter.create({
        render: () => <Snackbar variant="critical" message="동기화하지 못했어요. 다시 시도해요." />,
      });
    }
  }

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

  if (!user) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        backgroundColor: "var(--seed-color-bg-layer-default)",
      }}>
        <PageHeader title="" borderBottom={false} />
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "var(--seed-dimension-x3) var(--seed-dimension-x5) calc(var(--seed-dimension-x8) + var(--seed-safe-area-bottom))",
        }}>
          <VStack gap="x3">
            <Text textStyle="t8Bold" color="fg.neutral" whiteSpace="pre-line">
              {"시청 기록을\n이어보려면 동의가 필요해요"}
            </Text>
            <Text textStyle="t5Regular" color="fg.neutralMuted">
              Google 계정으로 로그인하고 스마트폰, 태블릿, 웹 어디서든 시청 기록을 동기화해요.
            </Text>
          </VStack>

          <VStack gap="x4">
            <CheckboxGroup
              label="개인정보 동의"
              indicator="필수"
              description="Google 계정 정보는 로그인과 시청 기록 동기화에만 사용돼요."
            >
              <Checkbox
                label={
                  <>
                    <Link href="/terms/privacy" onClick={(e) => e.stopPropagation()} className="settings-consent-link">
                      개인정보 처리방침
                    </Link>
                    에 동의해요
                  </>
                }
                tone="neutral"
                size="large"
                checked={loginConsent.privacy}
                onCheckedChange={(checked) => handleLoginConsentChange("privacy", checked)}
              />
              <Checkbox
                label="개인정보 국외 처리에 동의해요"
                tone="neutral"
                size="large"
                checked={loginConsent.overseasTransfer}
                onCheckedChange={(checked) => handleLoginConsentChange("overseasTransfer", checked)}
              />
              <Checkbox
                label="만 14세 이상이에요"
                tone="neutral"
                size="large"
                checked={loginConsent.ageOver14}
                onCheckedChange={(checked) => handleLoginConsentChange("ageOver14", checked)}
              />
            </CheckboxGroup>
            <ActionButton
              variant="neutralSolid"
              size="large"
              onClick={handleGoogleSignIn}
              disabled={!allLoginConsentChecked || loginLoading}
              loading={loginLoading}
              style={{ width: "100%", gap: "10px" }}
            >
              {GOOGLE_LOGO}
              Google로 계속하기
            </ActionButton>
          </VStack>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <PageHeader title="기기 및 동기화" borderBottom={false} />

      {user && (
        <VStack gap="x3">
          <ListHeader as="h2">동기화 설정</ListHeader>
          <List>
            <ListSwitchItem
              title="자동 동기화"
              detail="시청 기록을 모든 기기에서 자동으로 맞추고 보관해요."
              checked={autoSync}
              onCheckedChange={setAutoSync}
              suffix={<Switchmark />}
            />
            {!autoSync && (
              <div style={{ padding: "0 16px 8px", fontSize: "12px", color: "var(--seed-semantic-color-fg-warning)" }}>
                자동 동기화를 끄면 기록이 자동으로 저장되지 않아 데이터가 유실될 수 있어요.
              </div>
            )}
            <ListButtonItem
              title="지금 동기화"
              detail="모든 기기의 시청 기록을 수동으로 불러오고 저장해요."
              onClick={handleManualSync}
              disabled={syncing}
            />
          </List>
        </VStack>
      )}

      {user && (
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
