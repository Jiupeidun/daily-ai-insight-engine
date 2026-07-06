import type { Metadata } from "next";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily AI Insight Engine",
  description: "Structured AI news extraction, daily analysis, and visualization on Cloudflare."
};

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-KD5YSDV426";

const preferenceInitScript = `
(() => {
  try {
    const root = document.documentElement;
    const mode = localStorage.getItem("dai-theme") || "system";
    const locale = localStorage.getItem("dai-locale") || "zh";
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.themeMode = mode;
    root.dataset.theme = mode === "system" ? (systemDark ? "dark" : "light") : mode;
    root.dataset.lang = locale;
    root.lang = locale === "en" ? "en" : "zh-CN";
  } catch {}
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-theme="dark" data-theme-mode="system" data-lang="zh" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceInitScript }} />
      </head>
      <body>
        <GoogleAnalytics measurementId={GA_MEASUREMENT_ID} />
        {children}
      </body>
    </html>
  );
}
