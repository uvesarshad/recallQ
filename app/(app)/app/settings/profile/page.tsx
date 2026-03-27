import SettingsNav from "@/components/SettingsNav";
import ProfileSettingsClient from "../../../settings/profile/profile-settings-client";

export const dynamic = "force-dynamic";

export default function AppProfileSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <SettingsNav />
      <ProfileSettingsClient />
    </div>
  );
}
