"use client";

import { useEffect } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useStoredState } from "@/lib/hooks";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyThemePreferenceToDocument,
  isThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const options: { value: ThemePreference; label: string; description: string; Icon: React.ElementType }[] = [
  { value: "dark", label: "Dark", description: "Always use the dark palette.", Icon: Moon },
  { value: "light", label: "Light", description: "Always use the light palette.", Icon: Sun },
  { value: "system", label: "System", description: "Follow your OS preference automatically.", Icon: Monitor },
];

export default function AppearanceSettingsPage() {
  const [storedTheme, setTheme, hydrated] = useStoredState<ThemePreference | string>(THEME_STORAGE_KEY, DEFAULT_THEME);
  const theme = isThemePreference(storedTheme) ? storedTheme : DEFAULT_THEME;

  useEffect(() => {
    if (!isThemePreference(storedTheme)) {
      setTheme(DEFAULT_THEME);
    }
  }, [setTheme, storedTheme]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    return applyThemePreferenceToDocument(theme);
  }, [hydrated, theme]);

  return (
    <div className="space-y-6">
      <section className="rounded-modals border border-border bg-surface p-6">
        <h1 className="text-lg font-semibold text-text-primary">Appearance</h1>
        <p className="mt-1 text-sm text-text-muted">Choose how Recall looks on this device. This setting is stored in your browser.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {options.map(({ value, label, description, Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={active}
                className={`flex flex-col gap-3 rounded-cards border p-5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  active
                    ? "border-brand bg-brand/5 shadow-sm"
                    : "border-border bg-bg hover:border-brand/40 hover:bg-surface"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-brand" : "text-text-muted"}`} />
                <div>
                  <div className={`text-sm font-medium ${active ? "text-brand" : "text-text-primary"}`}>{label}</div>
                  <div className="mt-0.5 text-xs text-text-muted">{description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
