import SettingsNav from "@/components/SettingsNav";
import BillingSettingsClient from "../../../settings/billing/billing-settings-client";
import { isBillingEnabled } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default function AppBillingSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <SettingsNav showBilling={isBillingEnabled()} />
      <BillingSettingsClient />
    </div>
  );
}
