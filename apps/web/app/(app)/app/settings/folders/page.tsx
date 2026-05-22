import SettingsNav from "@/components/SettingsNav";
import { isBillingEnabled } from "@/lib/billing";
import FoldersSettingsClient from "./folders-settings-client";

export const dynamic = "force-dynamic";

export default function AppFoldersSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <SettingsNav showBilling={isBillingEnabled()} />
      <FoldersSettingsClient />
    </div>
  );
}
