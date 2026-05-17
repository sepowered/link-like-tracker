"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton, VStack, Icon, Portal } from "@seed-design/react";
import { RadioGroup, RadioGroupItem } from "@/ui/radio-group";
import { TextField, TextFieldTextarea } from "@/ui/text-field";
import { FieldButton, FieldButtonValue, FieldButtonPlaceholder } from "@/ui/field-button";
import { Snackbar, useSnackbarAdapter } from "@/ui/snackbar";
import { PageBanner, PageBannerButton } from "@/ui/page-banner";
import {
  BottomSheetRoot,
  BottomSheetContent,
  BottomSheetBody,
  BottomSheetFooter,
} from "@/ui/bottom-sheet";
import Link from "next/link";
import { IconArrowUpRightLine } from "@karrotmarket/react-monochrome-icon";
import type { Content } from "@/types";
import { submitEditRequest } from "@/app/actions/requests";
import PageHeader from "@/components/PageHeader";

const REQUEST_TYPES = [
  { value: "wrong-link", label: "링크가 달라요 (다른 영상으로 연결돼요)" },
  { value: "wrong-category", label: "분류가 달라요" },
  { value: "wrong-generation", label: "기수가 달라요" },
  { value: "private", label: "영상이 비공개 처리됐어요" },
  { value: "unnecessary", label: "이 콘텐츠는 필요 없어요" },
  { value: "other", label: "기타" },
] as const;

const CATEGORIES = [
  { value: "story", label: "스토리" },
  { value: "music", label: "음악" },
  { value: "fesxlive", label: "FesxLIVE" },
  { value: "fesxrec", label: "FesxReC" },
  { value: "withxmeets", label: "With×MEETS" },
  { value: "not-listed", label: "이 중에 없어요" },
];

function getDisplayTitle(content: Content, episodeTitle: string): string {
  if (content.type === "story") {
    return episodeTitle + (content.part_label ? ` (${content.part_label})` : "");
  }
  return content.title_ko ?? content.title_jp ?? "";
}

export default function EditRequestForm({
  content,
  episodeTitle,
  generations,
}: {
  content: Content;
  episodeTitle: string;
  generations: string[];
}) {
  const displayTitle = getDisplayTitle(content, episodeTitle);
  const primaryUrl = content.sources[0]?.url ?? "";
  const router = useRouter();
  const adapter = useSnackbarAdapter();
  const [requestType, setRequestType] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [generation, setGeneration] = useState<string>("");
  const [generationSheetOpen, setGenerationSheetOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsDescription = requestType === "wrong-category" && category === "not-listed";

  const isTypeInvalid = submitted && !requestType;
  const isCategoryInvalid = submitted && requestType === "wrong-category" && !category;
  const isGenerationInvalid = submitted && requestType === "wrong-generation" && !generation;
  const isDescriptionInvalid = submitted && needsDescription && !description.trim();
  const isFormInvalid =
    !requestType ||
    (requestType === "wrong-category" && !category) ||
    (requestType === "wrong-generation" && !generation) ||
    (needsDescription && !description.trim());

  const categoryLabel = CATEGORIES.find((c) => c.value === category)?.label;

  const handleSubmit = async () => {
    setSubmitted(true);
    if (isFormInvalid) return;
    
    setIsSubmitting(true);
    try {
      await submitEditRequest({
        video_title: displayTitle,
        request_type: requestType,
        category,
        generation,
        description,
      });
      adapter.create({
        render: () => <Snackbar message="수정 요청을 보냈어요." />,
      });
      router.back();
    } catch (error: any) {
      const errorMessage = error?.message || "요청 제출에 실패했어요. 다시 시도해 주세요.";
      adapter.create({
        render: () => <Snackbar message={errorMessage} />,
      });
    } finally {
      setIsSubmitting(false);
    }
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
      <PageHeader title="정보 수정 요청" />

      {/* 추가 요청 배너 - 헤더 바로 아래 */}
      <PageBanner
        tone="informative"
        description="아직 추가되지 않은 스토리 및 콘텐츠가 있나요?"
        suffix={
          <PageBannerButton asChild>
            <Link href="/add-request" style={{ textDecoration: "none" }}>추가 요청하기</Link>
          </PageBannerButton>
        }
      />

      {/* 콘텐츠 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px 0" }}>
        <VStack gap="x8">
          {/* 요청 대상 */}
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
              {displayTitle}
            </span>
            <ActionButton
              size="small"
              variant="neutralWeak"
              style={{ alignSelf: "flex-start" }}
              onClick={() => window.open(primaryUrl, "_blank", "noopener,noreferrer")}
            >
              유튜브에서 보기
              <Icon svg={<IconArrowUpRightLine />} size="14px" />
            </ActionButton>
          </VStack>

          {/* 요청 */}
          <RadioGroup
            label="요청"
            labelWeight="bold"
            showRequiredIndicator
            value={requestType}
            onValueChange={(v) => {
              setRequestType(v);
              if (v !== "wrong-category") setCategory("");
              if (v !== "wrong-generation") setGeneration("");
            }}
            invalid={isTypeInvalid}
            errorMessage={isTypeInvalid ? "문제 유형을 선택해주세요." : undefined}
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

          {/* 올바른 분류 - wrong-category 선택 시에만 표시 */}
          {requestType === "wrong-category" && (
            <BottomSheetRoot
              open={categorySheetOpen}
              onOpenChange={setCategorySheetOpen}
              closeOnEscape
              closeOnInteractOutside
            >
              <FieldButton
                label="분류 선택"
                labelWeight="bold"
                showRequiredIndicator
                values={category ? [category] : []}
                onValuesChange={([value]) => setCategory(value ?? "")}
                showClearButton={!!category}
                invalid={isCategoryInvalid}
                errorMessage={isCategoryInvalid ? "분류를 선택해주세요." : undefined}
                buttonProps={{
                  onClick: () => setCategorySheetOpen(true),
                  "aria-label": categoryLabel
                    ? `분류 변경. 현재: ${categoryLabel}`
                    : "분류 선택",
                  "aria-haspopup": "dialog",
                }}
              >
                {categoryLabel ? (
                  <FieldButtonValue>{categoryLabel}</FieldButtonValue>
                ) : (
                  <FieldButtonPlaceholder>분류를 선택해주세요</FieldButtonPlaceholder>
                )}
              </FieldButton>
              <Portal>
                <BottomSheetContent
                  title="분류 선택"
                  aria-describedby={undefined}
                  style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}
                >
                  <BottomSheetBody style={{ paddingBottom: "var(--seed-dimension-x6)" }}>
                    <RadioGroup
                      aria-label="분류 선택"
                      value={category}
                      onValueChange={(v) => {
                        setCategory(v);
                        setCategorySheetOpen(false);
                      }}
                    >
                      {CATEGORIES.map((cat) => (
                        <RadioGroupItem
                          key={cat.value}
                          value={cat.value}
                          label={cat.label}
                          tone="neutral"
                          size="large"
                        />
                      ))}
                    </RadioGroup>
                  </BottomSheetBody>
                </BottomSheetContent>
              </Portal>
            </BottomSheetRoot>
          )}

          {/* 올바른 기수 - wrong-generation 선택 시에만 표시 */}
          {requestType === "wrong-generation" && (
            <BottomSheetRoot
              open={generationSheetOpen}
              onOpenChange={setGenerationSheetOpen}
              closeOnEscape
              closeOnInteractOutside
            >
              <FieldButton
                label="기수 선택"
                labelWeight="bold"
                showRequiredIndicator
                values={generation ? [generation] : []}
                onValuesChange={([value]) => setGeneration(value ?? "")}
                showClearButton={!!generation}
                invalid={isGenerationInvalid}
                errorMessage={isGenerationInvalid ? "기수를 선택해주세요." : undefined}
                buttonProps={{
                  onClick: () => setGenerationSheetOpen(true),
                  "aria-label": generation
                    ? `기수 변경. 현재: ${generation}기`
                    : "기수 선택",
                  "aria-haspopup": "dialog",
                }}
              >
                {generation ? (
                  <FieldButtonValue>{generation}기</FieldButtonValue>
                ) : (
                  <FieldButtonPlaceholder>기수를 선택해주세요</FieldButtonPlaceholder>
                )}
              </FieldButton>
              <Portal>
                <BottomSheetContent
                  title="기수 선택"
                  aria-describedby={undefined}
                  style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}
                >
                  <BottomSheetBody style={{ paddingBottom: "var(--seed-dimension-x6)" }}>
                    <RadioGroup
                      aria-label="기수 선택"
                      value={generation}
                      onValueChange={(v) => {
                        setGeneration(v);
                        setGenerationSheetOpen(false);
                      }}
                    >
                      {generations.map((gen) => (
                        <RadioGroupItem
                          key={gen}
                          value={gen}
                          label={`${gen}기`}
                          tone="neutral"
                          size="large"
                        />
                      ))}
                    </RadioGroup>
                  </BottomSheetBody>
                </BottomSheetContent>
              </Portal>
            </BottomSheetRoot>
          )}

          {/* 추가 설명 */}
          <TextField
            label="추가 설명"
            {...(needsDescription
              ? {
                  showRequiredIndicator: true,
                  description: "올바른 분류가 무엇인지 설명해주세요.",
                  invalid: isDescriptionInvalid,
                  errorMessage: isDescriptionInvalid ? "추가 설명을 입력해주세요." : undefined,
                }
              : { indicator: "선택" })}
            value={description}
            onValueChange={({ value }) => setDescription(value)}
          >
            <TextFieldTextarea
              placeholder={needsDescription ? "올바른 분류를 알고 계신다면 적어주세요." : "더 자세한 내용이 있다면 알려주세요."}
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
          disabled={isSubmitting}
        >
          {isSubmitting ? "제출 중..." : "수정 요청 보내기"}
        </ActionButton>
      </div>
    </div>
  );
}
