"use client";

import { ActionButton, VStack } from "@seed-design/react";
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
import { Checkbox } from "@/ui/checkbox";
import type { ConflictPolicyMode } from "@/lib/progress-sync";

interface ProgressConflictSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localWatchedCount: number;
  remoteWatchedCount: number;
  resolution: ConflictPolicyMode;
  onResolutionChange: (mode: ConflictPolicyMode) => void;
  dontAskAgain: boolean;
  onDontAskAgainChange: (checked: boolean) => void;
  onConfirm: () => void;
}

// 기기 간 시청 기록 충돌 해결 BottomSheet. 상태는 ProgressSyncProvider가
// 소유하고, 이 컴포넌트는 표시만 담당한다.
export function ProgressConflictSheet({
  open,
  onOpenChange,
  localWatchedCount,
  remoteWatchedCount,
  resolution,
  onResolutionChange,
  dontAskAgain,
  onDontAskAgainChange,
  onConfirm,
}: ProgressConflictSheetProps) {
  const options: { value: ConflictPolicyMode; label: string; description: string }[] = [
    { value: "local", label: `이 기기 기록으로 맞추기 (${localWatchedCount}개)`, description: "다른 기기도 이 기기 기록으로 맞춰요." },
    { value: "remote", label: `저장된 기록으로 맞추기 (${remoteWatchedCount}개)`, description: "이 기기 기록을 저장된 기록으로 맞춰요." },
    { value: "latest", label: "자동으로 합치기", description: "영상마다 더 최근에 본 기록을 선택해요." },
  ];

  return (
    <BottomSheetRoot open={open} onOpenChange={onOpenChange} dismissible={false}>
      <BottomSheetContent
        title="기기마다 시청 기록이 달라요"
        description="어떤 기록으로 맞출지 골라요."
        showCloseButton={false}
        aria-describedby={undefined}
        style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}
      >
        <BottomSheetBody>
          <VStack gap="x4">
            <RadioSelectBoxRoot
              aria-label="충돌 해결 방식"
              value={resolution}
              onValueChange={(v) => onResolutionChange(v as ConflictPolicyMode)}
            >
              {options.map((option) => (
                <RadioSelectBoxItem
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  description={option.description}
                  suffix={<RadioSelectBoxRadiomark />}
                />
              ))}
            </RadioSelectBoxRoot>

            <Checkbox
              label="선택 기억하기"
              tone="neutral"
              checked={dontAskAgain}
              onCheckedChange={onDontAskAgainChange}
            />
          </VStack>
        </BottomSheetBody>
        <BottomSheetFooter>
          <ActionButton
            variant="neutralSolid"
            size="large"
            style={{ width: "100%" }}
            onClick={onConfirm}
          >
            확인
          </ActionButton>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheetRoot>
  );
}
