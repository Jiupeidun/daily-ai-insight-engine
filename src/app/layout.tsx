import type { Metadata } from "next";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily AI Insight Engine",
  description: "Structured AI news extraction, daily analysis, and visualization on Cloudflare."
};

const preferenceInitScript = `
(() => {
  try {
    const root = document.documentElement;
    const theme = localStorage.getItem("dai-theme") || "dark";
    const locale = localStorage.getItem("dai-locale") || "zh";
    root.dataset.theme = theme;
    root.dataset.lang = locale;
    root.lang = locale === "en" ? "en" : "zh-CN";
  } catch {}
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-theme="dark" data-lang="zh" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceInitScript }} />
      </head>
      <body>
        <GoogleAnalytics measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        {children}
      </body>
    </html>
  );
}
