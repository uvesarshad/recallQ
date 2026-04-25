"use client";

import { useEffect } from "react";

export default function PWASetup() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("Recall PWA: Service Worker registered with scope:", registration.scope);
          })
          .catch((error) => {
            console.error("Recall PWA: Service Worker registration failed:", error);
          });
      });
    }
  }, []);

  return null;
}
