"use client";

import { useEffect } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useStoredState } from "@/lib/hooks";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  getNextThemePreference,
  getThemePreferenceLabel,
  applyThemePreferenceToDocument,
  isThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const icons: Record<ThemePreference, React.ReactNode> = {
  dark: <Moon className="h-4 w-4" />,
  light: <Sun className="h-4 w-4" />,
  system: <Monitor className="h-4 w-4" />,
};

export default function ThemeToggle({
  className,
  initialTheme = DEFAULT_THEME,
}: {
  className?: string;
  initialTheme?: ThemePreference;
}) {
  const [storedTheme, setStoredTheme, hydrated] = useStoredState<ThemePreference | string>(THEME_STORAGE_KEY, initialTheme);
  const theme = isThemePreference(storedTheme) ? storedTheme : initialTheme;

  useEffect(() => {
    if (!isThemePreference(storedTheme)) {
      setStoredTheme(initialTheme);
    }
  }, [initialTheme, setStoredTheme, storedTheme]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    return applyThemePreferenceToDocument(theme);
  }, [hydrated, theme]);

  const label = getThemePreferenceLabel(theme);

  return (
    <button
      type="button"
      onClick={() => setStoredTheme(getNextThemePreference(theme))}
      title={label}
      aria-label={label}
      className={className}
    >
      {icons[theme]}
    </button>
  );
}
