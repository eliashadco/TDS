"use client";

import { useEffect } from "react";

const RELOAD_KEY = "ii-local-preview-cache-reset";

export default function LocalPreviewStabilizer() {
  useEffect(() => {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return;
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    let disposed = false;

    async function resetLocalPreviewState() {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const cacheKeys = "caches" in window ? await caches.keys() : [];

      if (registrations.length === 0 && cacheKeys.length === 0) {
        window.sessionStorage.removeItem(RELOAD_KEY);
        return;
      }

      await Promise.all(registrations.map((registration) => registration.unregister()));
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));

      if (disposed) {
        return;
      }

      if (window.sessionStorage.getItem(RELOAD_KEY) === "1") {
        window.sessionStorage.removeItem(RELOAD_KEY);
        return;
      }

      window.sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    }

    void resetLocalPreviewState();

    return () => {
      disposed = true;
    };
  }, []);

  return null;
}