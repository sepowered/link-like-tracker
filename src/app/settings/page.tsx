import { SettingsProvider } from "@/components/SettingsProvider";
import SettingsPageContent from "@/components/SettingsPageContent";

export default function SettingsPage() {
  return (
    <SettingsProvider>
      <main className="container">
        <SettingsPageContent />
      </main>
    </SettingsProvider>
  );
}
