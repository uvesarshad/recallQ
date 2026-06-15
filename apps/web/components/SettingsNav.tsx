"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { T, FONT } from "@recall/tokens";

const links = [
  { href: "/app/settings/profile", label: "Profile" },
  { href: "/app/settings/folders", label: "Folders" },
  { href: "/app/settings/integrations", label: "Integrations" },
  { href: "/app/settings/appearance", label: "Appearance" },
  { href: "/app/settings/billing", label: "Billing", billingOnly: true },
];

export default function SettingsNav({ showBilling = true }: { showBilling?: boolean }) {
  const pathname = usePathname();
  const visibleLinks = links.filter((link) => showBilling || !link.billingOnly);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 24,
        padding: "6px",
        borderRadius: 16,
        background: "rgba(255,255,255,0.45)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid " + T.glassEdge,
        boxShadow: T.shadowSoft,
      }}
    >
      {visibleLinks.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: "inline-block",
              padding: "8px 18px",
              borderRadius: 10,
              fontFamily: FONT,
              fontSize: 13.5,
              fontWeight: active ? 700 : 500,
              textDecoration: "none",
              transition: "all 0.2s",
              background: active
                ? "linear-gradient(120deg, " + T.azure + ", " + T.mint + ")"
                : "transparent",
              color: active ? "#fff" : T.inkSoft,
              boxShadow: active ? "0 2px 8px rgba(61,125,255,0.25)" : "none",
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
