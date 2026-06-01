"use client";

import { useSettings } from "@/components/SettingsProvider";
import PageHeader from "@/components/PageHeader";
import { Text, VStack } from "@seed-design/react";
import { List } from "@/ui/list";
import { ListHeader } from "@/ui/list-header";
import { RadioGroup, RadioGroupItem } from "@/ui/radio-group";

type LangCombo = "ko" | "jp" | "jp-ko";

const OPTIONS: { value: LangCombo; title: string; description: string }[] = [
  {
    value: "ko",
    title: "한국어",
    description: "콘텐츠와 UI 모두 한국어로 표시해요.",
  },
  {
    value: "jp",
    title: "日本語",
    description: "コンテンツとUIをすべて日本語で表示します。",
  },
  {
    value: "jp-ko",
    title: "콘텐츠 日本語",
    description: "콘텐츠는 일본어로, UI는 한국어로 표시해요.",
  },
];

export default function LanguagePage() {
  const { language, uiLanguage, setLanguage, setUiLanguage } = useSettings();

  const combo: LangCombo =
    language === "ko" ? "ko" : uiLanguage === "jp" ? "jp" : "jp-ko";

  function handleChange(value: string) {
    const v = value as LangCombo;
    if (v === "ko") {
      setLanguage("ko");
      setUiLanguage("ko");
    } else if (v === "jp") {
      setLanguage("jp");
      setUiLanguage("jp");
    } else {
      setLanguage("jp");
      setUiLanguage("ko");
    }
  }

  return (
    <div className="settings-page">
      <PageHeader title="언어" borderBottom={false} />

      <VStack gap="x3">
        <ListHeader as="h2">표시 언어</ListHeader>
        <List>
          <RadioGroup
            aria-label="표시 언어"
            value={combo}
            onValueChange={handleChange}
          >
            {OPTIONS.map(({ value, title, description }) => (
              <RadioGroupItem
                key={value}
                value={value}
                tone="neutral"
                size="large"
                label={
                  <VStack gap="x0.5">
                    <Text textStyle="t5Bold" color="fg.neutral">{title}</Text>
                    <Text textStyle="t4Regular" color="fg.neutralMuted">{description}</Text>
                  </VStack>
                }
              />
            ))}
          </RadioGroup>
        </List>
      </VStack>
    </div>
  );
}
