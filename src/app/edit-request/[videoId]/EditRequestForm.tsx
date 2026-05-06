"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton, HStack, VStack, Icon } from "@seed-design/react";
import { RadioGroup, RadioGroupItem } from "@/ui/radio-group";
import { TextField, TextFieldTextarea } from "@/ui/text-field";
import { Snackbar, useSnackbarAdapter } from "@/ui/snackbar";
import {
  IconArrowLeftLine,
  IconArrowUpRightLine,
} from "@karrotmarket/react-monochrome-icon";
import type { Video } from "@/types";

const REQUEST_TYPES = [
  { value: "wrong-link", label: "링크가 잘못됐어요 (다른 영상으로 연결돼요)" },
  { value: "private", label: "영상이 비공개됐어요" },
  { value: "unnecessary", label: "목록에 없어도 될 것 같아요" },
  { value: "other", label: "기타" },
] as const;

export default function EditRequestForm({ video }: { video: Video }) {
  const router = useRouter();
  const adapter = useSnackbarAdapter();
  const [requestType, setRequestType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const isInvalid = submitted && !requestType;

  const handleSubmit = () => {
    setSubmitted(true);
    if (!requestType) return;
    // TODO: 제출 로직 연결
    adapter.create({
      render: () => <Snackbar message="수정 요청을 보냈어요." />,
    });
    router.back();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* 헤더 */}
      <HStack
        align="center"
        style={{
          padding: "12px 4px 12px 4px",
          borderBottom: "1px solid var(--seed-scale-color-gray-100)",
          flexShrink: 0,
        }}
      >
        <ActionButton
          size="medium"
          variant="ghost"
          onClick={() => router.back()}
          aria-label="뒤로가기"
        >
          <Icon svg={<IconArrowLeftLine />} size="24px" />
        </ActionButton>
        <span
          style={{
            flex: 1,
            textAlign: "center",
            fontWeight: 600,
            fontSize: "17px",
          }}
        >
          정보 수정 요청
        </span>
        <div style={{ width: "44px" }} />
      </HStack>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px 0" }}>
        <VStack gap="x8">
          {/* 수정할 콘텐츠 정보 */}
          <VStack gap="x2">
            <span
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--seed-scale-color-gray-900)",
              }}
            >
              요청 대상
            </span>
            <span
              style={{
                fontSize: "15px",
                fontWeight: 400,
                color: "var(--seed-scale-color-gray-900)",
                lineHeight: 1.5,
                wordBreak: "keep-all",
                overflowWrap: "break-word",
              }}
            >
              {video.title}
            </span>
            <ActionButton
              size="small"
              variant="neutralWeak"
              style={{ alignSelf: "flex-start" }}
              onClick={() => window.open(video.url, "_blank", "noopener,noreferrer")}
            >
              유튜브에서 보기
              <Icon svg={<IconArrowUpRightLine />} size="14px" />
            </ActionButton>
          </VStack>

          {/* 수정 요청 종류 */}
          <RadioGroup
            label="어떤 문제인가요?"
            labelWeight="bold"
            showRequiredIndicator
            value={requestType}
            onValueChange={setRequestType}
            invalid={isInvalid}
            errorMessage={isInvalid ? "문제 유형을 선택해주세요." : undefined}
          >
            {REQUEST_TYPES.map((opt) => (
              <RadioGroupItem
                key={opt.value}
                value={opt.value}
                label={opt.label}
                tone="neutral"
                size="large"
              />
            ))}
          </RadioGroup>

          {/* 수정 요청 설명 */}
          <TextField
            label="추가 설명"
            indicator="선택"
            value={description}
            onValueChange={({ value }) => setDescription(value)}
          >
            <TextFieldTextarea
              placeholder="더 자세한 내용이 있다면 알려주세요."
              style={{ minHeight: "120px" }}
            />
          </TextField>
        </VStack>
      </div>

      {/* 하단 CTA */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--seed-scale-color-gray-100)",
          flexShrink: 0,
        }}
      >
        <ActionButton
          size="large"
          variant="neutralSolid"
          style={{ width: "100%" }}
          onClick={handleSubmit}
        >
          수정 요청 보내기
        </ActionButton>
      </div>
    </div>
  );
}
