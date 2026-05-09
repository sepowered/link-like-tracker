"use client";

import { useRouter } from "next/navigation";
import { ActionButton, HStack, Icon } from "@seed-design/react";
import { IconXmarkLine } from "@karrotmarket/react-monochrome-icon";

export default function TermsPageHeader({ title }: { title: string }) {
  const router = useRouter();

  return (
    <HStack
      align="center"
      style={{
        padding: "12px 4px",
        flexShrink: 0,
      }}
    >
      <div style={{ width: "44px" }} />
      <span
        style={{
          flex: 1,
          textAlign: "center",
          fontWeight: 600,
          fontSize: "17px",
        }}
      >
        {title}
      </span>
      <ActionButton
        size="medium"
        variant="ghost"
        onClick={() => router.back()}
        aria-label="닫기"
      >
        <Icon svg={<IconXmarkLine />} size="24px" />
      </ActionButton>
    </HStack>
  );
}
