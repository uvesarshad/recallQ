import { auth } from "@/lib/auth";
import { isBillingEnabled } from "@/lib/billing";
import { db } from "@/lib/db";
import EmailAddressCopy from "./EmailAddressCopy";
import SettingsNav from "@/components/SettingsNav";
import TelegramConnect from "./TelegramConnect";
import { Mail, Send } from "lucide-react";
import { redirect } from "next/navigation";
import { T, FONT } from "@recall/tokens";

export const dynamic = "force-dynamic";

const glassCard = {
  borderRadius: 20,
  overflow: "hidden",
  background: "rgba(255,255,255,.62)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid " + T.glassEdge,
  boxShadow: T.shadowSoft,
  marginBottom: 18,
} as const;

const sectionLabel = {
  padding: "14px 18px",
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 700,
  color: T.inkFaint,
  textTransform: "uppercase" as const,
  letterSpacing: ".6px",
  borderBottom: "1px solid " + T.line,
} as const;

export default async function AppIntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const result = await db.query(
    "SELECT inbound_email_address, telegram_chat_id FROM users WHERE id = $1",
    [session.user.id]
  );

  const user = result.rows[0];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <SettingsNav showBilling={isBillingEnabled()} />

      <div style={{ maxWidth: 620, margin: "0 auto", paddingBottom: 60 }}>
        <h1 style={{ fontFamily: FONT, fontSize: 26, fontWeight: 800, color: T.ink, margin: "8px 0 4px" }}>
          Integrations
        </h1>
        <p style={{ fontFamily: FONT, fontSize: 14, color: T.inkSoft, margin: "0 0 22px" }}>
          Connect your favourite capture surfaces to Recall.
        </p>

        {/* Telegram */}
        <div style={glassCard}>
          <div style={sectionLabel}>Telegram bot</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 18px", borderBottom: "1px solid " + T.line }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: "rgba(34,158,217,.1)", flexShrink: 0 }}>
                <Send size={18} color="#229ED9" />
              </div>
              <div>
                <div style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: T.ink }}>Telegram Bot</div>
                <div style={{ fontFamily: FONT, fontSize: 12.5, color: T.inkSoft }}>Forward anything to our bot.</div>
              </div>
            </div>
            {user.telegram_chat_id ? (
              <span style={{ padding: "2px 8px", borderRadius: 99, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", fontFamily: FONT, fontSize: 10, fontWeight: 700, color: "#16A34A", textTransform: "uppercase", letterSpacing: ".5px" }}>
                Linked
              </span>
            ) : (
              <span style={{ padding: "2px 8px", borderRadius: 99, background: "rgba(11,18,32,0.06)", border: "1px solid " + T.line, fontFamily: FONT, fontSize: 10, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: ".5px" }}>
                Not linked
              </span>
            )}
          </div>
          <div style={{ padding: "16px 18px" }}>
            <TelegramConnect initialLinked={!!user.telegram_chat_id} />
          </div>
        </div>

        {/* Email forwarding */}
        <div style={glassCard}>
          <div style={sectionLabel}>Email forwarding</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid " + T.line }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: "rgba(61,125,255,.1)", flexShrink: 0 }}>
              <Mail size={18} color={T.azure} />
            </div>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: T.ink }}>Email Forwarding</div>
              <div style={{ fontFamily: FONT, fontSize: 12.5, color: T.inkSoft }}>Forward emails to your unique address.</div>
            </div>
          </div>
          <div style={{ padding: "16px 18px" }}>
            <EmailAddressCopy address={user.inbound_email_address} />
            <p style={{ marginTop: 10, fontFamily: FONT, fontSize: 11, color: T.inkFaint }}>
              Tip: Save this as a contact named &quot;Recall&quot; in your phone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
