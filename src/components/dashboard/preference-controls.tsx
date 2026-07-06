"use client";

import { Languages, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeMode = "system" | "dark" | "light";
type Locale = "zh" | "en";

const DEFAULT_THEME: ThemeMode = "system";
const DEFAULT_LOCALE: Locale = "zh";

function getStoredPreference<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  return (window.localStorage.getItem(key) as T | null) ?? fallback;
}

function getStoredTheme(): ThemeMode {
  const stored = getStoredPreference("dai-theme", DEFAULT_THEME);
  return stored === "system" || stored === "light" || stored === "dark" ? stored : DEFAULT_THEME;
}

function getStoredLocale(): Locale {
  const stored = getStoredPreference("dai-locale", DEFAULT_LOCALE);
  return stored === "en" || stored === "zh" ? stored : DEFAULT_LOCALE;
}

function resolveTheme(theme: ThemeMode) {
  if (theme !== "system") {
    return theme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyPreferences(theme: ThemeMode, locale: Locale) {
  const root = document.documentElement;
  root.dataset.themeMode = theme;
  root.dataset.theme = resolveTheme(theme);
  root.dataset.lang = locale;
  root.lang = locale === "en" ? "en" : "zh-CN";
}

function trackPreference(name: string, value: string) {
  window.gtag?.("event", "set_preference", {
    preference_name: name,
    preference_value: value
  });
}

export function PreferenceControls() {
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const [locale, setLocale] = useState<Locale>(() => getStoredLocale());

  useEffect(() => {
    applyPreferences(theme, locale);
  }, [theme, locale]);

  useEffect(() => {
    if (theme !== "system") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => applyPreferences("system", locale);
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, [theme, locale]);

  const updateTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    window.localStorage.setItem("dai-theme", nextTheme);
    applyPreferences(nextTheme, locale);
    trackPreference("theme", nextTheme);
  };

  const updateLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    window.localStorage.setItem("dai-locale", nextLocale);
    applyPreferences(theme, nextLocale);
    trackPreference("locale", nextLocale);
  };

  return (
    <div className="preference-controls" aria-label="Display preferences">
      <div className="segmented-control" aria-label="Language">
        <span className="segment-icon" aria-hidden="true">
          <Languages size={14} />
        </span>
        <button
          type="button"
          aria-pressed={locale === "zh"}
          className={locale === "zh" ? "segment-button segment-button-active" : "segment-button"}
          onClick={() => updateLocale("zh")}
        >
          中
        </button>
        <button
          type="button"
          aria-pressed={locale === "en"}
          className={locale === "en" ? "segment-button segment-button-active" : "segment-button"}
          onClick={() => updateLocale("en")}
        >
          EN
        </button>
      </div>

      <div className="segmented-control" aria-label="Theme">
        <button
          type="button"
          aria-label="Use system theme"
          aria-pressed={theme === "system"}
          data-mode="system"
          className="icon-button theme-button"
          onClick={() => updateTheme("system")}
        >
          <Monitor size={14} />
        </button>
        <button
          type="button"
          aria-label="Dark theme"
          aria-pressed={theme === "dark"}
          data-mode="dark"
          className="icon-button theme-button"
          onClick={() => updateTheme("dark")}
        >
          <Moon size={14} />
        </button>
        <button
          type="button"
          aria-label="Light theme"
          aria-pressed={theme === "light"}
          data-mode="light"
          className="icon-button theme-button"
          onClick={() => updateTheme("light")}
        >
          <Sun size={14} />
        </button>
      </div>
    </div>
  );
}
