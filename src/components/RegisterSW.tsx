"use client";
import { useEffect } from "react";

// Registers the minimal service worker so the app is installable to the home
// screen on Android/Chrome. No-op on browsers without service-worker support.
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
