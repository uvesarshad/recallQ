"use client";

import { useEffect, useRef, useState } from "react";

export function useStoredState<T>(key: string, initial: T) {
  const initialRef = useRef(initial);
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        setValue(JSON.parse(stored) as T);
      } else {
        setValue(initialRef.current);
      }
    } catch {
      setValue(initialRef.current);
    } finally {
      setHydrated(true);
    }
  }, [key]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [hydrated, key, value]);

  return [value, setValue, hydrated] as const;
}
