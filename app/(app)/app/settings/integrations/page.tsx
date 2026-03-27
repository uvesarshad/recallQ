import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import EmailAddressCopy from "../../../settings/integrations/EmailAddressCopy";
import SettingsNav from "@/components/SettingsNav";
import TelegramConnect from "../../../settings/integrations/TelegramConnect";
import { Mail, Send } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AppIntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/app/login");

  const result = await db.query(
    "SELECT inbound_email_address, telegram_chat_id FROM users WHERE id = $1",
    [session.user.id]
  );

  const user = result.rows[0];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <SettingsNav />
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Integrations</h1>
        <p className="mt-1 text-sm text-text-mid">Connect your favourite capture surfaces to Recall.</p>
      </div>

      <div className="space-y-6">
        <section className="rounded-modals border border-border bg-surface p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#229ED9]/10 p-2">
                <Send className="h-5 w-5 text-[#229ED9]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Telegram Bot</h2>
                <p className="text-xs text-text-mid">Forward anything to our bot.</p>
              </div>
            </div>
            {user.telegram_chat_id ? (
              <span className="rounded bg-green-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-green-500">
                Linked
              </span>
            ) : (
              <span className="rounded bg-surface-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Not Linked
              </span>
            )}
          </div>

          <TelegramConnect initialLinked={!!user.telegram_chat_id} />
        </section>

        <section className="rounded-modals border border-border bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-item-link/10 p-2">
                <Mail className="h-5 w-5 text-item-link" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Email Forwarding</h2>
                <p className="text-xs text-text-mid">Forward emails to your unique address.</p>
              </div>
            </div>
          </div>

          <EmailAddressCopy address={user.inbound_email_address} />
          <p className="mt-3 text-[11px] text-text-muted">
            Tip: Save this as a contact named "Recall" in your phone.
          </p>
        </section>
      </div>
    </div>
  );
}
