export type ThemePreference = "dark" | "light" | "system";
export type AppliedTheme = "dark" | "light";

export const DEFAULT_THEME: ThemePreference = "dark";
export const THEME_STORAGE_KEY = "recall-theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "dark" || value === "light" || value === "system";
}

export function getNextThemePreference(theme: ThemePreference): ThemePreference {
  if (theme === "dark") return "light";
  if (theme === "light") return "system";
  return "dark";
}

export function getAppliedTheme(theme: ThemePreference, prefersDark: boolean): AppliedTheme {
  if (theme === "system") {
    return prefersDark ? "dark" : "light";
  }

  return theme;
}

export function getThemePreferenceLabel(theme: ThemePreference) {
  if (theme === "dark") return "Switch to light";
  if (theme === "light") return "Switch to system";
  return "Switch to dark";
}

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent | MediaQueryList) => void) => void;
};

export function applyThemePreferenceToDocument(theme: ThemePreference) {
  if (typeof document === "undefined") {
    return () => {};
  }

  const applyTheme = (prefersDark: boolean) => {
    document.documentElement.dataset.theme = getAppliedTheme(theme, prefersDark);
  };

  if (theme !== "system") {
    applyTheme(false);
    return () => {};
  }

  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    applyTheme(true);
    return () => {};
  }

  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const applyFromMedia = (event: MediaQueryListEvent | MediaQueryList) => {
    applyTheme(event.matches);
  };

  applyFromMedia(query);

  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", applyFromMedia);
    return () => query.removeEventListener("change", applyFromMedia);
  }

  const legacyQuery = query as LegacyMediaQueryList;
  legacyQuery.addListener?.(applyFromMedia);
  return () => legacyQuery.removeListener?.(applyFromMedia);
}
