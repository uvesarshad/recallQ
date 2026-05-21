"use client";

import { useEffect, useRef } from "react";

// Shared accessibility hooks for our two dialog components (CreateItemDialog,
// ItemDetailModal). Handles: (1) body scroll lock while the modal is open so
// the page underneath doesn't scroll when the user spins their wheel, (2)
// auto-focus the first focusable element on open, (3) focus restoration to
// whatever element opened the modal when it closes, (4) Tab/Shift+Tab focus
// trap so keyboard users can't escape into the page behind the backdrop.

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function useModalA11y(open: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Body scroll lock.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Capture currently-focused element on open, restore on close.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    return () => {
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  // Auto-focus the first focusable element after mount; also trap Tab.
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const container = containerRef.current;

    const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return containerRef;
}
