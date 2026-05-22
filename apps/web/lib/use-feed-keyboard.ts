"use client";

import { useEffect, useState } from "react";

// Keyboard-driven navigation for the Feed. Vim-style j/k between cards,
// Enter or e to open the detail modal, r for a quick "tomorrow 9 AM"
// reminder. Ignored while the user is typing in any input/textarea/
// contentEditable so the global handlers never steal characters.

export type FeedKeyboardActions = {
  itemCount: number;
  onOpen: (index: number) => void;
  onRemind: (index: number) => void;
  onCapture?: () => void;
};

export function useFeedKeyboard({
  itemCount,
  onOpen,
  onRemind,
  onCapture,
}: FeedKeyboardActions) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  // The visual focus ring only appears once the user actually presses a
  // navigation key — mouse-only users never see a stale ring.
  const [keyboardActive, setKeyboardActive] = useState(false);

  useEffect(() => {
    if (itemCount === 0) {
      setFocusedIndex(null);
      setKeyboardActive(false);
    } else if (focusedIndex !== null && focusedIndex >= itemCount) {
      setFocusedIndex(itemCount - 1);
    }
  }, [focusedIndex, itemCount]);

  // Scroll the focused card into view (centered) on every change.
  useEffect(() => {
    if (focusedIndex === null) return;
    if (typeof document === "undefined") return;
    const node = document.querySelector<HTMLElement>(
      `[data-feed-index="${focusedIndex}"]`,
    );
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusedIndex]);

  useEffect(() => {
    function isTyping(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return false;
    }

    function handler(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;

      const moveDown = event.key === "j" || event.key === "ArrowDown";
      const moveUp = event.key === "k" || event.key === "ArrowUp";

      if (moveDown || moveUp) {
        if (itemCount === 0) return;
        event.preventDefault();
        setKeyboardActive(true);
        setFocusedIndex((prev) => {
          if (prev === null) return moveDown ? 0 : itemCount - 1;
          const delta = moveDown ? 1 : -1;
          return Math.min(itemCount - 1, Math.max(0, prev + delta));
        });
        return;
      }

      if (event.key === "Enter" || event.key === "e") {
        if (focusedIndex === null || itemCount === 0) return;
        event.preventDefault();
        onOpen(focusedIndex);
        return;
      }

      if (event.key === "r") {
        if (focusedIndex === null || itemCount === 0) return;
        event.preventDefault();
        onRemind(focusedIndex);
        return;
      }

      if (event.key === "c" && onCapture) {
        event.preventDefault();
        onCapture();
        return;
      }

      if (event.key === "Escape" && keyboardActive) {
        setKeyboardActive(false);
        setFocusedIndex(null);
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusedIndex, itemCount, onOpen, onRemind, onCapture, keyboardActive]);

  // Mouse hover or click drops keyboard focus state so the next j/k starts
  // fresh from the current scroll position.
  function deactivateOnPointer() {
    if (keyboardActive) {
      setKeyboardActive(false);
      setFocusedIndex(null);
    }
  }

  return {
    focusedIndex,
    keyboardActive,
    setFocusedIndex,
    deactivateOnPointer,
  };
}
