"use client";
import { useEffect, useState } from "react";

// "Add to Home Screen" button. On Android/Chrome it fires the native install
// prompt; on iOS Safari (which has no programmatic install) it shows the manual
// steps. Hides itself entirely once the app is already installed (standalone).
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function AddToHomeScreen() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    // deferred (not a synchronous effect setState) — detect the platform once mounted
    const detect = () => {
      const ua = window.navigator.userAgent.toLowerCase();
      const nav = window.navigator as Navigator & { standalone?: boolean };
      const win = window as Window & { MSStream?: unknown };
      setIsIOS(/iphone|ipad|ipod/.test(ua) && !win.MSStream);
      setStandalone(
        window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
      );
    };
    const t = setTimeout(detect, 0);
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep our own button in control
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => setStandalone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone) return null; // already on the home screen
  if (!isIOS && !deferred) return null; // not installable here (or already prompted)

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      try {
        await deferred.userChoice;
      } finally {
        setDeferred(null);
      }
    } else {
      setShowHelp((s) => !s);
    }
  };

  return (
    <div className="mt-10 flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-full border border-lime/50 px-5 py-2 text-sm font-semibold text-lime transition-colors hover:bg-lime/10"
      >
        <span aria-hidden>📲</span> Add to Home Screen
      </button>
      {showHelp && isIOS && (
        <div className="max-w-xs rounded-xl border border-line bg-panel px-4 py-3 text-center text-xs text-mut">
          In Safari, tap the <b className="text-ink">Share</b> icon{" "}
          <span aria-hidden>(the square with an ↑)</span>, then{" "}
          <b className="text-ink">Add to Home Screen</b>. It saves as the{" "}
          <span className="text-lime">WC</span>
          <span className="text-ink">&apos;26</span> app icon.
        </div>
      )}
    </div>
  );
}
