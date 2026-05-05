import type { Metadata, Viewport } from "next";
import { generateThemingScript } from "@seed-design/css/theming";
import "@seed-design/css/all.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "하스노소라 시청 관리",
  description: "Link! Like! LoveLive! 하스노소라 플레이리스트 시청 관리",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "하스노소라 시청 관리",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

const themingScript = generateThemingScript({ mode: "system" });

// localStorage에 저장된 사용자 테마 적용 (generateThemingScript 이후 실행)
const themePreferenceScript = `try{var s=localStorage.getItem("seed-color-scheme");if(s==="dark")document.documentElement.dataset.seedColorMode="dark-only";else if(s==="light")document.documentElement.dataset.seedColorMode="light-only";}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themingScript }} />
        <script dangerouslySetInnerHTML={{ __html: themePreferenceScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
