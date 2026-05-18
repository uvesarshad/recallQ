"use client";

import dynamic from "next/dynamic";

const ThemeToggle = dynamic(() => import("@/components/ThemeToggle"), { ssr: false });

export default function ThemeToggleClient({
  className,
  initialTheme,
}: {
  className?: string;
  initialTheme?: "dark" | "light" | "system";
}) {
  return <ThemeToggle className={className} initialTheme={initialTheme} />;
}
