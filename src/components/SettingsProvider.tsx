"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { VideoCategory } from "@/lib/video-category";

export type ColorScheme = "light" | "dark" | "system";

interface Settings {
  progressCategories: VideoCategory[]; // empty = all categories
  hidePrivateVideos: boolean;
}

interface SettingsContextValue extends Settings {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  setProgressCategories: (categories: VideoCategory[]) => void;
  setHidePrivateVideos: (hide: boolean) => void;
  isInitialized: boolean;
}

const STORAGE_KEY = "llt-settings";
const THEME_KEY = "seed-color-scheme";

const DEFAULT_SETTINGS: Settings = {
  progressCategories: [],
  hidePrivateVideos: true,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const cats: string[] = Array.isArray(parsed.progressCategories) ? parsed.progressCategories : [];
    return {
      // Migrate: strip legacy "all" sentinel value (empty array now means all)
      progressCategories: cats.filter((c) => c !== "all") as VideoCategory[],
      hidePrivateVideos: parsed.hidePrivateVideos ?? DEFAULT_SETTINGS.hidePrivateVideos,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings to localStorage", e);
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>("light");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    try {
      const stored = localStorage.getItem(THEME_KEY);
      setColorSchemeState(stored === "dark" ? "dark" : stored === "light" ? "light" : "system");
    } catch {}
    setIsInitialized(true);
  }, []);

  const update = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const setColorScheme = (scheme: ColorScheme) => {
    document.documentElement.dataset.seedColorMode =
      scheme === "dark" ? "dark-only" : scheme === "light" ? "light-only" : "system";
    try {
      localStorage.setItem(THEME_KEY, scheme);
    } catch {}
    setColorSchemeState(scheme);
  };

  return (
    <SettingsContext.Provider
      value={{
        ...settings,
        colorScheme,
        setColorScheme,
        isInitialized,
        setProgressCategories: (categories) => update({ progressCategories: categories }),
        setHidePrivateVideos: (hide) => update({ hidePrivateVideos: hide }),
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
