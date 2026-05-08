"use client";

import { useRouter } from "next/navigation";
import { ActionButton, HStack, Icon } from "@seed-design/react";
import { IconArrowLeftLine } from "@karrotmarket/react-monochrome-icon";

interface AppBarNavProps {
  variant: "nav";
  title: string;
  onBack?: () => void;
  borderBottom?: boolean;
}

interface AppBarHomeProps {
  variant: "home";
  title: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

type AppBarProps = AppBarNavProps | AppBarHomeProps;

export default function AppBar(props: AppBarProps) {
  const router = useRouter();

  if (props.variant === "home") {
    const { title, leftSlot, rightSlot } = props;
    return (
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: "700",
              color: "var(--seed-color-fg-neutral)",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </h1>
          {leftSlot}
        </div>
        {rightSlot && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {rightSlot}
          </div>
        )}
      </div>
    );
  }

  const { title, onBack, borderBottom = true } = props;

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
