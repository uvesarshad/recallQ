"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  MessageSquare,
  Moon,
  Network,
  Plus,
  Search,
  Settings,
  Sun,
  Workflow,
} from "lucide-react";
import CreateItemDialog, { openCreateDialog } from "@/components/CreateItemDialog";
import Tooltip from "@/components/Tooltip";

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

import { useStoredState } from "@/lib/hooks";

export default function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SessionUser;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useStoredState("recall-sidebar-collapsed", false);
  const [theme, setTheme] = useStoredState<"dark" | "light">("recall-theme", "dark");
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const navItems = useMemo(
    () => [
      { href: "/app", label: "Feed", icon: LayoutDashboard },
      { href: "/app/canvas", label: "Canvas", icon: Workflow },
      { href: "/app/graph", label: "Graph", icon: Network },
      { href: "/app/chat", label: "Chat", icon: MessageSquare },
      { href: "/app/settings/profile", label: "Settings", icon: Settings },
    ],
    [],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text-primary">
      <aside className={`flex h-full shrink-0 flex-col border-r border-border bg-surface transition-all ${collapsed ? "w-20" : "w-[17rem]"}`}>
        <div className="flex items-center justify-between px-4 py-5">
          {!collapsed ? <span className="text-xl font-semibold tracking-tight">Recall</span> : <span className="mx-auto text-lg font-semibold">R</span>}
          <button className="rounded-buttons p-2 text-text-muted hover:bg-surface-2" onClick={() => setCollapsed((v) => !v)}>
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
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {!collapsed ? <span>{theme === "dark" ? "Light theme" : "Dark theme"}</span> : null}
          </button>
          <div className="flex items-center gap-3">
            {user.image ? (
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

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
          <div className="flex items-center gap-3 px-5 py-3">
            <form
              className="flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/app/search?q=${encodeURIComponent(query)}`);
              }}
            >
              <div className="flex items-center gap-2 rounded-input border border-border bg-surface px-3 py-2">
                <Search className="h-4 w-4 text-text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search across your archive"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-text-muted"
                />
              </div>
            </form>
            <button
              className="inline-flex items-center gap-2 rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white"
              onClick={() => openCreateDialog()}
            >
              <Plus className="h-4 w-4" />
              Create
            </button>
          </div>
        </header>
        <main className="min-w-0">{children}</main>
      </div>
      <CreateItemDialog />
    </div>
  );
}
