"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton, HStack, VStack, Icon, Portal } from "@seed-design/react";
import { TextField, TextFieldInput, TextFieldTextarea } from "@/ui/text-field";
import { FieldButton, FieldButtonValue, FieldButtonPlaceholder } from "@/ui/field-button";
import { RadioGroup, RadioGroupItem } from "@/ui/radio-group";
import { Snackbar, useSnackbarAdapter } from "@/ui/snackbar";
import {
  BottomSheetRoot,
  BottomSheetContent,
  BottomSheetBody,
} from "@/ui/bottom-sheet";
import { IconArrowLeftLine } from "@karrotmarket/react-monochrome-icon";
import { submitAddRequest } from "@/app/actions/requests";

const CATEGORIES = [
  { value: "story", label: "스토리" },
  { value: "music", label: "음악" },
  { value: "fesxlive", label: "FesxLIVE" },
  { value: "fesxrec", label: "FesxReC" },
  { value: "withxmeets", label: "With×MEETS" },
  { value: "not-listed", label: "이 중에 없어요" },
];

export default function AddRequestForm({ generations }: { generations: string[] }) {
  const router = useRouter();
  const adapter = useSnackbarAdapter();
  const [link, setLink] = useState("");
  const [category, setCategory] = useState("");
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [generation, setGeneration] = useState("");
  const [generationSheetOpen, setGenerationSheetOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsDescription = category === "not-listed";
  const isLinkInvalid = submitted && !link.trim();
  const isCategoryInvalid = submitted && !category;
  const isGenerationInvalid = submitted && !generation;
  const isDescriptionInvalid = submitted && needsDescription && !description.trim();
  const categoryLabel = CATEGORIES.find((c) => c.value === category)?.label;

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!link.trim() || !category || !generation || (needsDescription && !description.trim())) return;
    
    setIsSubmitting(true);
    try {
      await submitAddRequest({
        link,
        category,
        generation,
        description,
      });
      adapter.create({
        render: () => <Snackbar message="콘텐츠 추가 요청을 보냈어요." />,
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
          콘텐츠 추가 요청
        </span>
        <div style={{ width: "44px" }} />
      </HStack>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px 0" }}>
        <VStack gap="x8">
          {/* 콘텐츠 링크 (필수) */}
          <TextField
            label="콘텐츠 링크"
            labelWeight="bold"
            showRequiredIndicator
            value={link}
            onValueChange={({ value }) => setLink(value)}
            invalid={isLinkInvalid}
            errorMessage={isLinkInvalid ? "링크를 입력해주세요." : undefined}
          >
            <TextFieldInput placeholder="유튜브 링크를 붙여넣어 주세요." />
          </TextField>

          {/* 분류 + 기수 선택 */}
          <HStack gap="x3" align="flex-start">
            <BottomSheetRoot
              open={categorySheetOpen}
              onOpenChange={setCategorySheetOpen}
              closeOnEscape
              closeOnInteractOutside
            >
              <FieldButton
                label="콘텐츠 분류"
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
                  <FieldButtonPlaceholder>선택해주세요</FieldButtonPlaceholder>
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

            <BottomSheetRoot
              open={generationSheetOpen}
              onOpenChange={setGenerationSheetOpen}
              closeOnEscape
              closeOnInteractOutside
            >
              <FieldButton
                label="기수"
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
                  <FieldButtonPlaceholder>선택해주세요</FieldButtonPlaceholder>
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
          </HStack>

          {/* 요청 내용 */}
          <TextField
            label="요청 내용"
            {...(needsDescription
              ? {
                  showRequiredIndicator: true,
                  description: "분류에 해당하는 내용을 설명해주세요.",
                  invalid: isDescriptionInvalid,
                  errorMessage: isDescriptionInvalid ? "요청 내용을 입력해주세요." : undefined,
                }
              : { indicator: "선택" })}
            value={description}
            onValueChange={({ value }) => setDescription(value)}
          >
            <TextFieldTextarea
              placeholder={needsDescription ? "어떤 분류가 맞는지 알려주세요." : "추가되었으면 하는 이유나 관련 내용을 자유롭게 적어주세요."}
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
          {isSubmitting ? "제출 중..." : "추가 요청 보내기"}
        </ActionButton>
      </div>
    </div>
  );
}
