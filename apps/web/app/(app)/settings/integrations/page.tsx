import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Mail, Send } from "lucide-react";
import TelegramConnect from "./TelegramConnect";
import EmailAddressCopy from "./EmailAddressCopy";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const result = await db.query(
    `SELECT inbound_email_address, telegram_chat_id FROM users WHERE id = $1`,
    [session.user.id],
  );
  const row = result.rows[0] ?? {};
  const inboundEmail = row.inbound_email_address as string | null;
  const telegramLinked = !!row.telegram_chat_id;

  return (
    <div className="space-y-6">
      <section className="rounded-modals border border-border bg-surface p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-full bg-brand/10 p-2 text-brand">
            <Send className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Telegram</h2>
            <p className="text-sm text-text-muted">
              Save anything directly from the Telegram app — links, text, images, and files.
            </p>
          </div>
        </div>
        <TelegramConnect initialLinked={telegramLinked} />
      </section>

      <section className="rounded-modals border border-border bg-surface p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-full bg-brand/10 p-2 text-brand">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Email forwarding</h2>
            <p className="text-sm text-text-muted">
              Forward any email to your personal Recall address and it will be saved automatically.
            </p>
          </div>
        </div>

        {inboundEmail ? (
          <>
            <p className="text-sm text-text-muted">Your inbound address:</p>
            <EmailAddressCopy address={inboundEmail} />
            <p className="mt-3 text-xs text-text-muted">
              Forward newsletters, receipts, or any email here. The subject becomes the title and the body is saved as content.
            </p>
          </>
        ) : (
          <div className="rounded-cards border border-border bg-bg p-4 text-sm text-text-muted">
            Email forwarding is not enabled on this account. Contact support or enable it via the Resend integration in your server settings.
          </div>
        )}
      </section>
    </div>
  );
}
