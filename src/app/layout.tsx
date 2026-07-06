import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily AI Insight Engine",
  description: "Structured AI news extraction, daily analysis, and visualization on Cloudflare."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
