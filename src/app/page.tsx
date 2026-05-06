import { storage } from "@/lib/playlist";
import PlaylistView from "@/components/PlaylistView";
import SettingsLink from "@/components/SettingsLink";
import HasuLogo from "@/components/HasuLogo";

export default async function Home() {
  const data = await storage.getPlaylist();
  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1 style={{
            fontSize: "24px",
            fontWeight: "700",
            color: "var(--seed-color-fg-neutral)",
            margin: "0 0 2px 0",
            letterSpacing: "-0.02em"
          }}>
            link-like-tracker
          </h1>
        </div>
        <SettingsLink />
      </div>
      <PlaylistView initialData={data} />
    </main>
  );
}
