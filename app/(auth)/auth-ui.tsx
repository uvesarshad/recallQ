import Link from "next/link";
import type { ReactNode } from "react";

export function AuthPage({
  children,
  eyebrow,
  title,
  subtitle,
}: {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-[420px] rounded-modals border border-border bg-surface p-8 shadow-lg">
        <div className="space-y-7">
          <div className="text-center">
            {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p> : null}
            <h1 className="font-sans text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
            <p className="mt-2 text-sm text-text-mid">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthMessage({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  const className =
    tone === "success"
      ? "rounded-buttons border border-note/30 bg-note/10 px-3 py-2 text-sm text-note"
      : "rounded-buttons border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300";

  return <div className={className}>{children}</div>;
}

export function AuthFooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-brand transition-colors hover:text-brand-hover">
      {children}
    </Link>
  );
}

export const inputClassName =
  "w-full rounded-input border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand-glow";
