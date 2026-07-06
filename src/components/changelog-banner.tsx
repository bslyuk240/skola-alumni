"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { APP_VERSION, CHANGELOG } from "@/config/changelog";

const LAST_SEEN_KEY = "skola-last-seen-version";

export function ChangelogBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
    if (lastSeen === APP_VERSION) return;
    // A first-time visitor has nothing to catch up on — just baseline them silently.
    if (!lastSeen) {
      localStorage.setItem(LAST_SEEN_KEY, APP_VERSION);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
  }, []);

  function handleDismiss() {
    localStorage.setItem(LAST_SEEN_KEY, APP_VERSION);
    setVisible(false);
  }

  const latest = CHANGELOG[0];
  if (!visible || !latest) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-xl rounded-lg border border-neutral-200 bg-white p-4 shadow-lg sm:inset-x-auto sm:right-4 sm:bottom-20 sm:w-96">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
          <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">What&apos;s new in v{latest.version}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-neutral-700">
            {latest.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss changelog"
          className="shrink-0 rounded-md p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md bg-primary-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-700"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
