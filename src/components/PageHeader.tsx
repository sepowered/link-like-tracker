"use client";

import { useRouter } from "next/navigation";
import { ActionButton, HStack, Icon } from "@seed-design/react";
import { IconArrowLeftLine } from "@karrotmarket/react-monochrome-icon";

interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  borderBottom?: boolean;
}

export default function PageHeader({ title, onBack, borderBottom = true }: PageHeaderProps) {
  const router = useRouter();

  return (
    <HStack
      align="center"
      style={{
        padding: "12px 4px",
        ...(borderBottom && { borderBottom: "1px solid var(--seed-scale-color-gray-100)" }),
        flexShrink: 0,
      }}
    >
      <ActionButton
        size="medium"
        variant="ghost"
        onClick={onBack ?? (() => router.back())}
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
        {title}
      </span>
      <div style={{ width: "44px" }} />
    </HStack>
  );
}
