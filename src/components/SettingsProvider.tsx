"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { VideoCategory } from "@/lib/video-category";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { downloadSettings, uploadSettings } from "@/lib/supabase-settings";
import type { SyncedSettings } from "@/lib/supabase-settings";
import { useAuth } from "@/providers/AuthProvider";

export type ColorScheme = "light" | "dark" | "system";
export type Language = "ko" | "jp";

interface SettingsContextValue extends SyncedSettings {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  setProgressCategories: (categories: VideoCategory[]) => void;
  setHidePrivateVideos: (hide: boolean) => void;
  setAutoSync: (autoSync: boolean) => void;
  isInitialized: boolean;
}

const STORAGE_KEY = "llt-settings";
const THEME_KEY = "seed-color-scheme";
const LANGUAGE_KEY = "llt-language";

const DEFAULT_SETTINGS: SyncedSettings = {
  progressCategories: [],
  hidePrivateVideos: true,
  autoSync: true,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}

function loadSettings(): SyncedSettings {
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
      autoSync: parsed.autoSync ?? DEFAULT_SETTINGS.autoSync,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: SyncedSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings to localStorage", e);
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<SyncedSettings>(DEFAULT_SETTINGS);
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>("light");
  const [language, setLanguageState] = useState<Language>("ko");
  const [isInitialized, setIsInitialized] = useState(false);
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
    try {
      const stored = localStorage.getItem(THEME_KEY);
      setColorSchemeState(stored === "dark" ? "dark" : stored === "light" ? "light" : "system");
      const storedLang = localStorage.getItem(LANGUAGE_KEY);
      setLanguageState(storedLang === "jp" ? "jp" : "ko");
    } catch {}
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized || authLoading) return;

    if (!user) {
      setSyncedUserId(null);
      return;
    }

    let cancelled = false;
    const userId = user.id;

    async function syncRemoteSettings() {
      const supabase = getSupabaseBrowserClient();

      try {
        const remote = await downloadSettings(supabase, userId);

        if (cancelled) return;

        if (remote) {
          setSettings(remote);
          saveSettings(remote);
        } else {
          const local = loadSettings();
          await uploadSettings(supabase, userId, local);
        }

        if (!cancelled) setSyncedUserId(userId);
      } catch (error) {
        console.error("Settings sync error:", error);
      }
    }

    syncRemoteSettings();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isInitialized, user]);

  const update = (patch: Partial<SyncedSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);

      if (user && syncedUserId === user.id) {
        const supabase = getSupabaseBrowserClient();
        uploadSettings(supabase, user.id, next).catch((error) => {
          console.error("Settings upload error:", error);
        });
      }

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

  const setLanguage = (lang: Language) => {
    try {
      localStorage.setItem(LANGUAGE_KEY, lang);
    } catch {}
    setLanguageState(lang);
  };

  return (
    <SettingsContext.Provider
      value={{
        ...settings,
        colorScheme,
        setColorScheme,
        language,
        setLanguage,
        isInitialized,
        setProgressCategories: (categories) => update({ progressCategories: categories }),
        setHidePrivateVideos: (hide) => update({ hidePrivateVideos: hide }),
        setAutoSync: (autoSync) => update({ autoSync }),
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
