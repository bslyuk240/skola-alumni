"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

export function PwaUpdateBanner() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    function trackInstalling(worker: ServiceWorker) {
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(worker);
        }
      });
    }

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      registration = reg;

      // A previously-detected update may already be sitting in "waiting" from before this
      // component mounted (e.g. it finished installing while the tab was backgrounded).
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(reg.waiting);
      }

      reg.addEventListener("updatefound", () => {
        if (reg.installing) trackInstalling(reg.installing);
      });
    });

    function handleControllerChange() {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    // Standalone PWAs can stay open for days without a full navigation, which is normally what
    // triggers a service worker update check — so poll for one periodically instead.
    function checkForUpdate() {
      if (document.visibilityState === "visible") registration?.update();
    }
    const interval = setInterval(checkForUpdate, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", checkForUpdate);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      document.removeEventListener("visibilitychange", checkForUpdate);
      clearInterval(interval);
    };
  }, []);

  function handleRefresh() {
    setRefreshing(true);
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  }

  if (!waitingWorker) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-xl rounded-lg border border-primary-200 bg-primary-50 p-3 shadow-lg sm:inset-x-auto sm:left-4 sm:bottom-20 sm:w-96">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
          <RefreshCw className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">New version available</p>
          <p className="text-xs text-neutral-700">Refresh to get the latest updates.</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="shrink-0 rounded-md bg-primary-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}
