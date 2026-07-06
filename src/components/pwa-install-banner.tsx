"use client";

import { useEffect, useState } from "react";
import { Download, Plus, Share2, Smartphone, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "skola-pwa-install-dismissed";

function isStandaloneMode() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };

  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function isIOSDevice() {
  const navigatorWithTouch = navigator as Navigator & { maxTouchPoints?: number };

  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigatorWithTouch.maxTouchPoints ?? 0) > 1)
  );
}

function isAndroidDevice() {
  return /Android/i.test(navigator.userAgent);
}

export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (sessionStorage.getItem(DISMISSED_KEY) === "true") return;
    if (isStandaloneMode()) return;

    const ios = isIOSDevice();
    const android = isAndroidDevice();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIOS(ios);
    if (ios) setVisible(true);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      if (android) setVisible(true);
    }

    function handleAppInstalled() {
      setVisible(false);
      setDeferredPrompt(null);
      sessionStorage.setItem(DISMISSED_KEY, "true");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    if (choice.outcome === "dismissed") {
      sessionStorage.setItem(DISMISSED_KEY, "true");
    }
    setVisible(false);
  }

  function handleDismiss() {
    sessionStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-xl rounded-lg border border-neutral-300 bg-white p-4 shadow-lg sm:inset-x-auto sm:right-4 sm:bottom-20 sm:w-[28rem]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
          <Smartphone className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">Install Skola Alumni</p>
          {isIOS ? (
            <div className="mt-1 space-y-2 text-sm text-neutral-700">
              <p>Add this app to your home screen for quicker access.</p>
              <ol className="space-y-1 text-xs text-neutral-700">
                <li className="flex items-center gap-1.5">
                  <Share2 className="h-3.5 w-3.5 text-primary-600" strokeWidth={1.75} aria-hidden="true" />
                  Tap Share in Safari.
                </li>
                <li className="flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-primary-600" strokeWidth={1.75} aria-hidden="true" />
                  Choose Add to Home Screen.
                </li>
              </ol>
            </div>
          ) : (
            <p className="mt-1 text-sm text-neutral-700">
              Add the app to your phone for a faster, full-screen experience.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md px-3 py-2 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
        >
          Not now
        </button>
        {isIOS ? (
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-md bg-primary-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-700"
          >
            Got it
          </button>
        ) : (
          <button
            type="button"
            onClick={handleInstall}
            disabled={!deferredPrompt}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            Install
          </button>
        )}
      </div>
    </div>
  );
}
