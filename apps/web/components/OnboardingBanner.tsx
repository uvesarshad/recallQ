"use client";

import {
  ArrowRight,
  Globe,
  Mail,
  Send,
  Smartphone,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { openCreateDialog } from "@/components/CreateItemDialog";

// Empty-state for a fresh archive. Matches the redesigned Feed: same
// max-w-3xl column, same card vocabulary, semantic color tokens only.
// Lists the four capture surfaces that exist today (Web / Extension /
// Mobile / Telegram-and-Email) so the user can pick whichever feels
// closest to how they actually save things.

const surfaces = [
  {
    Icon: Zap,
    title: "Quick capture",
    description: "Paste any URL or note straight from the app. Opens with ⌘⇧C.",
    cta: "Open capture",
    onClick: () => openCreateDialog(),
    color: "text-brand",
    bg: "bg-brand/10",
  },
  {
    Icon: Globe,
    title: "Chrome extension",
    description: "Right-click on any link or selection → Save to RecallQ. Background sync to your archive.",
    cta: "Get extension",
    href: "https://chrome.google.com/webstore",
    color: "text-item-link",
    bg: "bg-item-link/10",
  },
  {
    Icon: Smartphone,
    title: "iOS & Android",
    description: "Share to RecallQ from any app. Works offline — captures sync when you're back online.",
    cta: "Get the app",
    href: "/app/settings/integrations",
    color: "text-item-media",
    bg: "bg-item-media/10",
  },
  {
    Icon: Send,
    title: "Telegram & email",
    description: "Forward anything from Telegram or your inbox to your private RecallQ address.",
    cta: "Set up",
    href: "/app/settings/integrations",
    color: "text-item-note",
    bg: "bg-item-note/10",
  },
];

export default function OnboardingBanner() {
  return (
    <div className="mx-auto mt-2 max-w-3xl px-5 pb-12">
      {/* Hero */}
      <div className="rounded-modals border border-brand/20 bg-gradient-to-br from-brand/8 via-surface to-surface px-7 py-8">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-brand">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight text-text-primary">
              Your archive is empty.
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-text-mid">
              Save anything from anywhere — RecallQ enriches it with a title, summary, and tags in the background. Pick a way to get started.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openCreateDialog()}
                className="inline-flex items-center gap-2 rounded-buttons bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover"
              >
                <Zap className="h-4 w-4" />
                Capture something
              </button>
              <Link
                href="/app/chat"
                className="inline-flex items-center gap-2 rounded-buttons border border-border bg-surface px-4 py-2 text-sm text-text-primary hover:border-brand/40"
              >
                Try chat →
              </Link>
              <span className="ml-1 text-[11px] text-text-muted">
                Tip: press <kbd className="rounded border border-border bg-bg px-1.5 font-mono text-[10px]">?</kbd> for keyboard shortcuts
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Capture surface grid */}
      <h3 className="mt-10 mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        Capture from anywhere
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {surfaces.map(({ Icon, title, description, cta, onClick, href, color, bg }) => {
          const Body = (
            <>
              <div className="flex items-start gap-3.5">
                <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-text-muted">
                    {description}
                  </p>
                </div>
              </div>
              {cta ? (
                <div className={`mt-4 inline-flex items-center gap-1.5 text-xs font-medium ${color} transition group-hover:gap-2`}>
                  {cta}
                  <ArrowRight className="h-3 w-3" />
                </div>
              ) : null}
            </>
          );

          if (href) {
            return (
              <Link
                key={title}
                href={href}
                className="group rounded-cards border border-border bg-surface p-5 transition hover:border-brand/40 hover:bg-surface-2"
              >
                {Body}
              </Link>
            );
          }

          return (
            <button
              key={title}
              type="button"
              onClick={onClick}
              className="group rounded-cards border border-border bg-surface p-5 text-left transition hover:border-brand/40 hover:bg-surface-2"
            >
              {Body}
            </button>
          );
        })}
      </div>

      <p className="mt-6 flex items-center gap-2 text-[11px] text-text-muted">
        <Mail className="h-3 w-3" />
        Your private capture email and Telegram bot link are on the Integrations page.
      </p>
    </div>
  );
}
