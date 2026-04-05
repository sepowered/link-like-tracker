"use client";

import { useEffect, useState } from "react";
import { Icon, SegmentedControl } from "@seed-design/react";
import { IconSunLine, IconMoonLine } from "@karrotmarket/react-monochrome-icon";

type ColorScheme = "light" | "dark";

function getCurrentScheme(): ColorScheme {
  if (typeof window === "undefined") return "light";
  return (document.documentElement.dataset.seedUserColorScheme as ColorScheme) ?? "light";
}

export default function ThemeToggle() {
  const [scheme, setScheme] = useState<ColorScheme>("light");

  useEffect(() => {
    setScheme(getCurrentScheme());
  }, []);

  function handleThemeChange(value: string) {
    const next = value as ColorScheme;
    console.log("Changing theme to:", next);
    
    document.documentElement.dataset.seedUserColorScheme = next;
    document.documentElement.dataset.seedColorMode =
      next === "dark" ? "dark-only" : "light-only";
    
    setScheme(next);
    
    try {
      localStorage.setItem("seed-color-scheme", next);
    } catch (e) {
      console.error("Failed to save theme to localStorage", e);
    }
  }

  return (
    <SegmentedControl.Root
      value={scheme}
      onValueChange={handleThemeChange}
      style={{ width: "fit-content", minWidth: "auto" }}
    >
      <SegmentedControl.Indicator />
      <SegmentedControl.Item value="light" style={{ minWidth: "40px", padding: "0 8px" }}>
        <SegmentedControl.ItemHiddenInput />
        <Icon svg={<IconSunLine />} size="20px" />
      </SegmentedControl.Item>
      <SegmentedControl.Item value="dark" style={{ minWidth: "40px", padding: "0 8px" }}>
        <SegmentedControl.ItemHiddenInput />
        <Icon svg={<IconMoonLine />} size="20px" />
      </SegmentedControl.Item>
    </SegmentedControl.Root>
  );
}
