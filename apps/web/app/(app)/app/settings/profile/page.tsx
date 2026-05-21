import SettingsNav from "@/components/SettingsNav";
import { isBillingEnabled } from "@/lib/billing";
import ProfileSettingsClient from "./profile-settings-client";

export const dynamic = "force-dynamic";

export default function AppProfileSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <SettingsNav showBilling={isBillingEnabled()} />
      <ProfileSettingsClient />
    </div>
  );
}
