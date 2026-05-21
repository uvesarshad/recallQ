// Mirrors the web's --app-* token palette so the mobile app feels native to
// the same brand. Hex literals here are duplicated from
// `apps/web/app/globals.css` rather than shared because NativeWind doesn't
// run inside a browser CSS context — extracting both into a shared package
// is a v1.5 cleanup.

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#0f0f11",
        surface: "#18181b",
        "surface-2": "#27272a",
        border: "#3f3f46",
        "border-soft": "#27272a",
        "text-primary": "#fafafa",
        "text-mid": "#a1a1aa",
        "text-muted": "#71717a",
        brand: "#6366f1",
        "brand-hover": "#818cf8",
      },
    },
  },
  plugins: [],
};
