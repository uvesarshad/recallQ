"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Workflow,
  X,
} from "lucide-react";
import CreateItemDialog, { openCreateDialog } from "@/components/CreateItemDialog";
import Tooltip from "@/components/Tooltip";
import { useStoredState } from "@/lib/hooks";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyThemePreferenceToDocument,
  getNextThemePreference,
  getThemePreferenceLabel,
  isThemePreference,
  type ThemePreference,
} from "@/lib/theme";

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export default function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SessionUser;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useStoredState("recall-sidebar-collapsed", false);
  const [storedTheme, setTheme, themeHydrated] = useStoredState<ThemePreference | string>(THEME_STORAGE_KEY, DEFAULT_THEME);
  const theme = isThemePreference(storedTheme) ? storedTheme : DEFAULT_THEME;
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isThemePreference(storedTheme)) {
      setTheme(DEFAULT_THEME);
    }
  }, [setTheme, storedTheme]);

  // Keep the search input in sync with the URL so that clearing the search
  // pill on the Feed page (which navigates to /app) also clears the input,
  // and so that landing on /app?q=foo shows "foo" pre-filled.
  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  useEffect(() => {
    if (!themeHydrated) {
      return;
    }

    return applyThemePreferenceToDocument(theme);
  }, [theme, themeHydrated]);

  function cycleTheme() {
    setTheme(getNextThemePreference(theme));
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        openCreateDialog();
        return;
      }

      if (!isEditable && event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (event.key === "Escape" && mobileNavOpen) {
        setMobileNavOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen]);

  const navItems = useMemo(
    () => [
      { href: "/app", label: "Feed", icon: LayoutDashboard },
      { href: "/app/canvas", label: "Canvas", icon: Workflow },
      { href: "/app/chat", label: "Chat", icon: MessageSquare },
      { href: "/app/settings/profile", label: "Settings", icon: Settings },
    ],
    [],
  );

  const mobileTabs = useMemo(
    () => [
      { href: "/app", label: "Feed", icon: LayoutDashboard },
      { href: "/app/canvas", label: "Canvas", icon: Workflow },
      { href: "/app/chat", label: "Chat", icon: MessageSquare },
      { href: "/app/settings/profile", label: "Settings", icon: Settings },
    ],
    [],
  );

  const themeLabel = getThemePreferenceLabel(theme);

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text-primary md:pb-0">
      <aside className={`hidden h-full shrink-0 flex-col border-r border-border bg-surface transition-all md:flex ${collapsed ? "w-20" : "w-[17rem]"}`}>
        <div className="flex items-center justify-between px-4 py-5">
          {!collapsed ? <span className="text-xl font-semibold tracking-tight">Recall</span> : <span className="mx-auto text-lg font-semibold">R</span>}
          <button
            type="button"
            className="rounded-buttons p-2 text-text-muted hover:bg-surface-2"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="space-y-1 px-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/app" && pathname.startsWith(href));
            const content = (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-buttons px-3 py-2.5 text-sm transition ${active ? "bg-brand text-white" : "text-text-mid hover:bg-surface-2 hover:text-text-primary"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed ? <span>{label}</span> : null}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={href} content={label} position="right">
                  {content}
                </Tooltip>
              );
            }

            return content;
          })}
        </nav>

        <div className="mt-auto border-t border-border p-4">
          <button
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-buttons border border-border bg-bg px-3 py-2 text-sm text-text-mid hover:bg-surface-2"
            onClick={cycleTheme}
            title={themeLabel}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : theme === "light" ? <Monitor className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {!collapsed ? <span>{themeLabel}</span> : null}
          </button>
          <div className="flex items-center gap-3">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- provider avatar URLs are dynamic and not constrained to known image hosts
              <img src={user.image} alt={user.name || "User"} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">
                {user.name?.[0] || "U"}
              </div>
            )}
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{user.name || "Profile"}</p>
                <p className="truncate text-xs text-text-muted">{user.email}</p>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto pb-16 md:pb-0">
        <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 md:px-5">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-buttons border border-border bg-surface text-text-primary md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>

            <form
              className="flex-1"
              onSubmit={(event) => {
                event.preventDefault();
                router.push(query.trim() ? `/app?q=${encodeURIComponent(query.trim())}` : "/app");
              }}
            >
              <div className="flex items-center gap-2 rounded-input border border-border bg-surface px-3 py-2">
                <Search className="h-4 w-4 text-text-muted" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search across your archive"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-text-muted"
                />
                <span className="hidden items-center gap-1 md:inline-flex">
                  <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] text-text-muted">⌘K</kbd>
                  <span className="text-[10px] text-text-muted/50">/</span>
                  <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] text-text-muted">/</kbd>
                </span>
              </div>
            </form>
            <button
              className="inline-flex items-center gap-2 rounded-buttons bg-brand px-3 py-2 text-sm font-medium text-white md:px-4"
              onClick={() => openCreateDialog()}
              title="Capture (⌘⇧C)"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Capture</span>
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1">
          <div className="min-w-0">{children}</div>
        </main>
      </div>

      <div className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition md:hidden ${mobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}>
        <div className={`h-full w-[18rem] max-w-[85vw] border-r border-border bg-surface transition-transform ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between border-b border-border px-4 py-5">
            <div>
              <div className="text-lg font-semibold text-text-primary">Recall</div>
              <div className="text-xs text-text-muted">Navigate the workspace</div>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-buttons border border-border bg-bg text-text-primary"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="space-y-1 px-3 py-4">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/app" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileNavOpen(false)}
                  className={`flex items-center gap-3 rounded-buttons px-3 py-3 text-sm transition ${active ? "bg-brand text-white" : "text-text-mid hover:bg-surface-2 hover:text-text-primary"}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-border p-4">
            <button
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-buttons border border-border bg-bg px-3 py-2 text-sm text-text-mid hover:bg-surface-2"
              onClick={cycleTheme}
              title={themeLabel}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : theme === "light" ? <Monitor className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span>{themeLabel}</span>
            </button>
            <div className="flex items-center gap-3">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- provider avatar URLs are dynamic and not constrained to known image hosts
                <img src={user.image} alt={user.name || "User"} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">
                  {user.name?.[0] || "U"}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{user.name || "Profile"}</p>
                <p className="truncate text-xs text-text-muted">{user.email}</p>
              </div>
            </div>
          </div>
        </div>
        <button type="button" className="absolute inset-0 -z-10" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation backdrop" />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t border-border bg-surface/95 backdrop-blur md:hidden">
        {mobileTabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/app" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] transition ${active ? "text-brand" : "text-text-muted"}`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <CreateItemDialog />
    </div>
  );
}
