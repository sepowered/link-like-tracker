import type { Metadata } from "next";
import { generateThemingScript } from "@seed-design/css/theming";
import "@seed-design/css/all.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "하스노소라 시청 관리",
  description: "Link! Like! LoveLive! 하스노소라 플레이리스트 시청 관리",
  manifest: "/manifest.json",
  themeColor: "#000000",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "하스노소라 시청 관리",
  },
};

const themingScript = generateThemingScript({ mode: "system" });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themingScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
