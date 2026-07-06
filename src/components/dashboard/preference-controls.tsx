"use client";

import { Languages, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";
type Locale = "zh" | "en";

const DEFAULT_THEME: Theme = "dark";
const DEFAULT_LOCALE: Locale = "zh";

function getStoredPreference<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  return (window.localStorage.getItem(key) as T | null) ?? fallback;
}

function getStoredTheme(): Theme {
  const stored = getStoredPreference("dai-theme", DEFAULT_THEME);
  return stored === "light" || stored === "dark" ? stored : DEFAULT_THEME;
}

function getStoredLocale(): Locale {
  const stored = getStoredPreference("dai-locale", DEFAULT_LOCALE);
  return stored === "en" || stored === "zh" ? stored : DEFAULT_LOCALE;
}

function applyPreferences(theme: Theme, locale: Locale) {
  const root = document.documentElement;
  root.dataset.theme = theme;
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
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const [locale, setLocale] = useState<Locale>(() => getStoredLocale());

  useEffect(() => {
    applyPreferences(theme, locale);
  }, [theme, locale]);

  const updateTheme = (nextTheme: Theme) => {
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
          aria-label="Dark theme"
          aria-pressed={theme === "dark"}
          className={theme === "dark" ? "icon-button icon-button-active" : "icon-button"}
          onClick={() => updateTheme("dark")}
        >
          <Moon size={14} />
        </button>
        <button
          type="button"
          aria-label="Light theme"
          aria-pressed={theme === "light"}
          className={theme === "light" ? "icon-button icon-button-active" : "icon-button"}
          onClick={() => updateTheme("light")}
        >
          <Sun size={14} />
        </button>
      </div>
    </div>
  );
}
