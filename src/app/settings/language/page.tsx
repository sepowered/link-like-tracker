"use client";

import { useSettings, type Language } from "@/components/SettingsProvider";
import PageHeader from "@/components/PageHeader";
import { Text, VStack } from "@seed-design/react";
import { List, ListRadioItem } from "@/ui/list";
import { ListHeader } from "@/ui/list-header";
import { Radiomark } from "@/ui/radio-group";
import { RadioGroup } from "@seed-design/react/primitive";

const LANG_OPTIONS: { value: Language; title: string }[] = [
  { value: "ko", title: "한국어" },
  { value: "jp", title: "日本語" },
];

function LanguageSection({
  header,
  ariaLabel,
  value,
  onValueChange,
}: {
  header: string;
  ariaLabel: string;
  value: Language;
  onValueChange: (lang: Language) => void;
}) {
  return (
    <VStack>
      <ListHeader as="h2">{header}</ListHeader>
      <List asChild>
        <RadioGroup.Root
          aria-label={ariaLabel}
          value={value}
          onValueChange={(v) => onValueChange(v as Language)}
        >
          {LANG_OPTIONS.map(({ value: optionValue, title }) => (
            <ListRadioItem
              key={optionValue}
              value={optionValue}
              prefix={<Radiomark tone="neutral" size="large" />}
              title={<Text textStyle="t5Bold" color="fg.neutral">{title}</Text>}
            />
          ))}
        </RadioGroup.Root>
      </List>
    </VStack>
  );
}

export default function LanguagePage() {
  const { language, uiLanguage, setLanguage, setUiLanguage } = useSettings();

  return (
    <div className="settings-page">
      <PageHeader title="언어" borderBottom={false} />

      <VStack gap="x6">
        {/*
          TODO(i18n): uiLanguage is persisted but not yet consumed anywhere in the
          app — changing it has no visible effect until app-wide UI translation
          (i18n) is wired up. Tracked as a separate effort; keep this selector as
          the access point for that future work.
        */}
        <LanguageSection
          header="UI 언어"
          ariaLabel="UI 언어"
          value={uiLanguage}
          onValueChange={setUiLanguage}
        />
        <LanguageSection
          header="콘텐츠 언어"
          ariaLabel="콘텐츠 언어"
          value={language}
          onValueChange={setLanguage}
        />
      </VStack>
    </div>
  );
}
