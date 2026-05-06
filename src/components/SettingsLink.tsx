"use client";

import Link from "next/link";
import { ActionButton, Icon } from "@seed-design/react";
import { IconGearLine } from "@karrotmarket/react-monochrome-icon";

export default function SettingsLink() {
  return (
    <ActionButton variant="ghost" size="small" aria-label="설정" asChild>
      <Link href="/settings">
        <Icon svg={<IconGearLine />} size="22px" />
      </Link>
    </ActionButton>
  );
}
