import SettingsNav from "@/components/SettingsNav";
import { isBillingEnabled } from "@/lib/billing";
import AppearanceSettingsPage from "../../../settings/appearance/appearance-settings-client";

export const dynamic = "force-dynamic";

export default function AppAppearanceSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <SettingsNav showBilling={isBillingEnabled()} />
      <AppearanceSettingsPage />
    </div>
  );
}
