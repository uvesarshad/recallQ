"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/app/settings/profile", label: "Profile" },
  { href: "/app/settings/integrations", label: "Integrations" },
];

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-buttons px-4 py-2 text-sm ${active ? "bg-brand text-white" : "border border-border bg-surface text-text-mid hover:bg-surface-2"}`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
