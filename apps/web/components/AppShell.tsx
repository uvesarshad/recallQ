"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import CreateItemDialog, { openCreateDialog } from "@/components/CreateItemDialog";
import { useStoredState } from "@/lib/hooks";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyThemePreferenceToDocument,
  isThemePreference,
  type ThemePreference,
} from "@/lib/theme";
import { T } from "@recall/tokens";
import Atmosphere from "@/components/Atmosphere";
import FloatingMenu from "@/components/FloatingMenu";
import CaptureBar from "@/components/CaptureBar";
import QueryProvider from "@/providers/QueryProvider";
import ChatDock from "@/components/ChatDock";

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
  const [storedTheme, setTheme, themeHydrated] = useStoredState<
    ThemePreference | string
  >(THEME_STORAGE_KEY, DEFAULT_THEME);
  const theme = isThemePreference(storedTheme) ? storedTheme : DEFAULT_THEME;

  useEffect(() => {
    if (!isThemePreference(storedTheme)) {
      setTheme(DEFAULT_THEME);
    }
  }, [setTheme, storedTheme]);

  useEffect(() => {
    if (!themeHydrated) {
      return;
    }
    return applyThemePreferenceToDocument(theme);
  }, [theme, themeHydrated]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "c"
      ) {
        event.preventDefault();
        openCreateDialog();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Suppress unused variable warning — pathname may be used by child nav components
  void pathname;
  // Suppress unused variable warning — user available for future use
  void user;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--app-bg)",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* Atmosphere composites app-wide — it renders behind the entire
          authenticated app, including the scrolling feed, so its blurred blobs
          stay in the compositor's paint path during scroll. Left mounted here
          on purpose (removing it is a visual/product change). Future perf work
          can gate it (e.g. pause/hide while the feed scrolls). Blur was already
          reduced 80px→40px in Atmosphere.tsx (P0.3). Per-card backdrop-filter
          scroll reduction is deferred — it needs profiling + scroll detection. */}
      <Atmosphere />
      <FloatingMenu />

      {/* Sticky capture header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          justifyContent: "center",
          padding: "16px 18px 14px",
          paddingLeft: 78,
          background: "var(--app-header-bg)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(11,18,32,0.07)",
        }}
      >
        <CaptureBar />
      </header>

      <QueryProvider>
        <main style={{ position: "relative", zIndex: 1 }}>{children}</main>
      </QueryProvider>

      <ChatDock />
      <CreateItemDialog />
    </div>
  );
}
