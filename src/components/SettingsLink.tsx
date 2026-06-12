"use client";

import { useRouter } from "next/navigation";
import { ActionButton, Icon } from "@seed-design/react";
import {
  IconArrow2ClockwiseCircularLine,
  IconGlobeLine,
  IconGearLine,
  IconHorizline3VerticalLine,
} from "@karrotmarket/react-monochrome-icon";
import { MenuRoot, MenuTrigger, MenuContent, MenuItem } from "@/ui/menu";

export default function SettingsLink() {
  const router = useRouter();

  return (
    <MenuRoot placement="bottom-end">
      <MenuTrigger asChild>
        <ActionButton variant="ghost" size="small" aria-label="메뉴">
          <Icon svg={<IconHorizline3VerticalLine />} size="22px" />
        </ActionButton>
      </MenuTrigger>
      <MenuContent>
        <MenuItem
          prefixIcon={<IconArrow2ClockwiseCircularLine />}
          label="동기화"
          onClick={() => router.push("/settings/sync")}
        />
        <MenuItem
          prefixIcon={<IconGlobeLine />}
          label="언어"
          onClick={() => router.push("/settings/language")}
        />
        <MenuItem
          prefixIcon={<IconGearLine />}
          label="설정"
          onClick={() => router.push("/settings")}
        />
      </MenuContent>
    </MenuRoot>
  );
}
