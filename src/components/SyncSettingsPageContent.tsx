"use client";

import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useProgressSync } from "@/providers/ProgressSyncProvider";
import type { ProgressMergeMode } from "@/providers/ProgressSyncProvider";
import PageHeader from "@/components/PageHeader";
import { ActionButton, Divider, Icon, VStack } from "@seed-design/react";
import { List, ListButtonItem, ListItem } from "@/ui/list";
import { ListHeader } from "@/ui/list-header";
import { Snackbar, useSnackbarAdapter } from "@/ui/snackbar";
import {
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetRoot,
} from "@/ui/bottom-sheet";
import {
  RadioSelectBoxItem,
  RadioSelectBoxRadiomark,
  RadioSelectBoxRoot,
} from "@/ui/select-box";
import {
  IconPersonCircleLine,
  IconTrashcanLine,
} from "@karrotmarket/react-monochrome-icon";

const MERGE_OPTIONS: {
  value: ProgressMergeMode;
  label: string;
  description: string;
}[] = [
  {
    value: "latest",
    label: "자동으로 합치기",
    description: "영상마다 더 최근에 본 기록을 선택해요.",
  },
  {
    value: "local",
    label: "현재 기기 기록으로 맞추기",
    description: "다른 기기 기록을 현재 기기 기록으로 바꿔요.",
  },
  {
    value: "remote",
    label: "클라우드 기록 가져오기",
    description: "현재 기기 기록을 클라우드에 있는 기록으로 바꿔요.",
  },
];

export default function SyncSettingsPageContent() {
  const { user } = useAuth();
  const {
    devices,
    devicesLoading,
    currentDeviceId,
    syncing,
    deleteDevice,
    mergeAllDevices,
    resetConflictPolicy,
  } = useProgressSync();
  const adapter = useSnackbarAdapter();
  const [mergeSheetOpen, setMergeSheetOpen] = useState(false);
  const [mergeMode, setMergeMode] = useState<ProgressMergeMode>("latest");

  async function handleMergeConfirm() {
    await mergeAllDevices(mergeMode);
    setMergeSheetOpen(false);
    adapter.create({
      render: () => (
        <Snackbar variant="positive" message="기기별 기록을 합쳤어요." />
      ),
    });
  }

  return (
    <div className="settings-page">
      <PageHeader title="기기 및 동기화" borderBottom={false} />

      <VStack gap="x6">
        {!user ? (
          <VStack gap="x3">
            <ListHeader as="h2">계정</ListHeader>
            <List>
              <ListItem
                title="로그인이 필요해요"
                detail="Google로 로그인하면 기기별 시청 기록을 동기화할 수 있어요."
                prefix={<Icon svg={<IconPersonCircleLine />} size="32px" />}
              />
            </List>
          </VStack>
        ) : (
          <>
            <VStack gap="x3">
              <ListHeader as="h2">기기 목록</ListHeader>
              <List>
                {devicesLoading ? (
                  <ListItem title="기기 목록 불러오는 중..." />
                ) : devices.length === 0 ? (
                  <ListItem title="연결된 기기가 없어요" detail="기록을 동기화하면 이곳에 기기가 표시돼요." />
                ) : (
                  devices.map((device) => {
                    const isCurrent = device.device_id === currentDeviceId;
                    const name = device.device_name ?? `기기 ${device.device_id.slice(0, 8)}`;
                    const lastSeen = new Date(device.last_seen_at).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                    });

                    return (
                      <ListItem
                        key={device.device_id}
                        title={isCurrent ? `${name} (현재 기기)` : name}
                        detail={`최근 동기화: ${lastSeen}`}
                        suffix={
                          !isCurrent ? (
                            <ActionButton
                              variant="ghost"
                              size="small"
                              color="fg.critical"
                              layout="iconOnly"
                              aria-label="기기 삭제"
                              onClick={async () => {
                                await deleteDevice(device.device_id);
                                adapter.create({
                                  render: () => (
                                    <Snackbar variant="positive" message="기기 기록을 삭제했어요." />
                                  ),
                                });
                              }}
                            >
                              <Icon svg={<IconTrashcanLine />} />
                            </ActionButton>
                          ) : undefined
                        }
                      />
                    );
                  })
                )}
              </List>
            </VStack>

            <Divider />

            <VStack gap="x3">
              <ListHeader as="h2">동기화 관리</ListHeader>
              <List>
                <ListButtonItem
                  title={syncing ? "기록 합치는 중..." : "기기별 기록 합치기"}
                  detail="여러 기기에 나뉜 시청 기록을 하나로 합쳐요."
                  disabled={syncing || devices.length === 0}
                  onClick={() => setMergeSheetOpen(true)}
                />
                <ListButtonItem
                  title="동기화 충돌 설정 초기화"
                  detail="다시 물어보도록 기록 합치기 선택을 초기화해요."
                  disabled={devices.length === 0}
                  onClick={() => {
                    resetConflictPolicy();
                    adapter.create({
                      render: () => (
                        <Snackbar variant="positive" message="동기화 설정을 초기화했어요." />
                      ),
                    });
                  }}
                />
              </List>
            </VStack>
          </>
        )}
      </VStack>

      <BottomSheetRoot
        open={mergeSheetOpen}
        onOpenChange={setMergeSheetOpen}
        closeOnEscape
        closeOnInteractOutside
      >
        <BottomSheetContent
          title="기록을 어떻게 합칠까요?"
          description="선택한 방식으로 기기별 시청 기록을 맞춰요."
          showCloseButton
          style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}
        >
          <BottomSheetBody style={{ paddingBottom: "var(--seed-dimension-x4)" }}>
            <RadioSelectBoxRoot
              aria-label="기록 합치기 방식"
              value={mergeMode}
              onValueChange={(value) => setMergeMode(value as ProgressMergeMode)}
            >
              {MERGE_OPTIONS.map((option) => (
                <RadioSelectBoxItem
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  description={option.description}
                  suffix={<RadioSelectBoxRadiomark />}
                />
              ))}
            </RadioSelectBoxRoot>
          </BottomSheetBody>
          <BottomSheetFooter>
            <ActionButton
              variant="neutralSolid"
              size="large"
              onClick={handleMergeConfirm}
              disabled={syncing}
              loading={syncing}
              style={{ width: "100%" }}
            >
              기록 합치기
            </ActionButton>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheetRoot>
    </div>
  );
}
