"use client";

import React, { useEffect } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useStoredState } from "@/lib/hooks";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyThemePreferenceToDocument,
  isThemePreference,
  type ThemePreference,
} from "@/lib/theme";
import { T, FONT } from "@recall/tokens";

const options: { value: ThemePreference; label: string; description: string; Icon: React.ElementType }[] = [
  { value: "dark", label: "Dark", description: "Always use the dark palette.", Icon: Moon },
  { value: "light", label: "Light", description: "Always use the light palette.", Icon: Sun },
  { value: "system", label: "System", description: "Follow your OS preference automatically.", Icon: Monitor },
];

const glassCard: React.CSSProperties = {
  borderRadius: 20,
  overflow: "hidden",
  background: "rgba(255,255,255,.62)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid " + T.glassEdge,
  boxShadow: T.shadowSoft,
  marginBottom: 18,
};

const sectionLabel: React.CSSProperties = {
  padding: "14px 18px",
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 700,
  color: T.inkFaint,
  textTransform: "uppercase",
  letterSpacing: ".6px",
  borderBottom: "1px solid " + T.line,
};

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
    <div style={{ maxWidth: 620, margin: "0 auto", paddingBottom: 60 }}>
      <h1 style={{ fontFamily: FONT, fontSize: 26, fontWeight: 800, color: T.ink, margin: "8px 0 4px" }}>
        Appearance
      </h1>
      <p style={{ fontFamily: FONT, fontSize: 14, color: T.inkSoft, margin: "0 0 22px" }}>
        Choose how Recall looks on this device. This setting is stored in your browser.
      </p>

      <div style={glassCard}>
        <div style={sectionLabel}>Theme</div>
        <div style={{ padding: "18px", display: "grid", gap: 12, gridTemplateColumns: "repeat(3, 1fr)" }}>
          {options.map(({ value, label, description, Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={active}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: "18px 16px",
                  borderRadius: 14,
                  border: active ? "1.5px solid " + T.azure : "1.5px solid " + T.line,
                  background: active
                    ? "rgba(61,125,255,0.06)"
                    : "rgba(255,255,255,0.5)",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: active ? "0 0 0 2px rgba(61,125,255,0.15)" : "none",
                  outline: "none",
                }}
              >
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: "grid",
                  placeItems: "center",
                  background: active ? "rgba(61,125,255,0.12)" : "rgba(11,18,32,0.05)",
                }}>
                  <Icon size={18} color={active ? T.azure : T.inkFaint} />
                </div>
                <div>
                  <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: active ? T.azure : T.ink }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 12, color: T.inkSoft, marginTop: 2 }}>
                    {description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
