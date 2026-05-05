import { storage } from "@/lib/playlist";
import PlaylistView from "@/components/PlaylistView";
import SettingsSheet from "@/components/SettingsSheet";
import HasuLogo from "@/components/HasuLogo";
import { SettingsProvider } from "@/components/SettingsProvider";

export default async function Home() {
  const data = await storage.getPlaylist();
  return (
    <SettingsProvider>
      <main className="container">
        <div className="page-header">
          <div>
            <h1 style={{ 
              fontSize: "24px", 
              fontWeight: "800", 
              color: "var(--seed-color-fg-neutral)",
              margin: "0 0 2px 0",
              letterSpacing: "-0.02em"
            }}>
              Link! Like! Tracker!
            </h1>
            <p style={{ fontSize: "13px", color: "var(--seed-color-fg-placeholder)", marginBottom: 0 }}>
              하스노소라 여학원 스쿨 아이돌 클럽 Link! Like! 러브 라이브! 활동기록 모아보기
            </p>
          </div>
          <SettingsSheet />
        </div>
        <PlaylistView initialData={data} />
      </main>
    </SettingsProvider>
  );
}
