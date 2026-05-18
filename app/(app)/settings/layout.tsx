"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Layers, Plug, User } from "lucide-react";

const tabs = [
  { href: "/app/settings/profile", label: "Profile", icon: User },
  { href: "/app/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/app/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/app/settings/appearance", label: "Appearance", icon: Layers },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
        <p className="mt-0.5 text-sm text-text-muted">Manage your account, billing, and preferences.</p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto md:w-44 md:flex-col md:overflow-x-visible">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-buttons px-3 py-2 text-sm transition ${
                  active
                    ? "bg-surface text-text-primary font-medium border border-border"
                    : "text-text-muted hover:bg-surface hover:text-text-primary"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
