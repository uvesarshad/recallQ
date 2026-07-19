"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Rss, LayoutGrid, Settings } from "lucide-react";
import { T, FONT, SPRING_UI } from "@recall/tokens";

const NAV_ITEMS = [
  { href: "/app", label: "Feed", icon: Rss },
  { href: "/app/canvas", label: "Canvas", icon: LayoutGrid },
  { href: "/app/settings/profile", label: "Settings", icon: Settings },
];

export default function FloatingMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <div
      style={{
        position: "fixed",
        top: 18,
        left: 18,
        zIndex: 60,
      }}
    >
      <motion.button
        type="button"
        whileTap={reduce ? undefined : { scale: 0.92 }}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close menu" : "Open menu"}
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          background: T.glass,
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          border: `1px solid ${T.glassEdge}`,
          boxShadow: T.shadow,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: T.ink,
        }}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { scale: 0.9, y: -8, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.9, y: -8, opacity: 0 }}
            transition={SPRING_UI}
            style={{
              position: "absolute",
              top: 54,
              left: 0,
              width: 200,
              borderRadius: 18,
              background: T.glass,
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              border: `1px solid ${T.glassEdge}`,
              boxShadow: T.shadowLift,
              padding: 8,
              transformOrigin: "top left",
            }}
          >
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== "/app" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: 12,
                    textDecoration: "none",
                    fontFamily: FONT,
                    fontSize: 14.5,
                    fontWeight: active ? 700 : 500,
                    color: active ? T.azure : T.inkSoft,
                    background: active ? "rgba(61,125,255,.1)" : "transparent",
                    transition: "background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)",
                  }}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
