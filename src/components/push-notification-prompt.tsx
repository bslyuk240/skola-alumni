"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { getFirebaseApp, isFirebaseConfigured } from "@/lib/firebase-client";
import { fetchJson } from "@/lib/fetch-json";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export function PushNotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured() || !VAPID_KEY) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    // Notification.permission is a browser-only API — can't read it during render (breaks SSR/
    // hydration parity), so this genuinely needs an effect, not a lazy useState initializer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Notification.permission === "default") setVisible(true);
  }, []);

  async function handleEnable() {
    setRequesting(true);
    setErrorMessage(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setVisible(false);
        return;
      }

      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const { getMessaging, getToken } = await import("firebase/messaging");
      const messaging = getMessaging(getFirebaseApp());

      const fcmToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (!fcmToken) throw new Error("Couldn't get a notification token");

      await fetchJson("/api/push/subscribe", { method: "POST", body: { fcmToken } });
      setVisible(false);
    } catch {
      setErrorMessage("Couldn't enable notifications right now.");
    } finally {
      setRequesting(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-primary-100 bg-primary-100 px-4 py-3">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 shrink-0 text-primary-700" strokeWidth={1.75} />
        <p className="text-sm text-primary-700">Get notified about announcements and new dues.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {errorMessage && <span className="text-xs text-error-700">{errorMessage}</span>}
        <button
          type="button"
          onClick={handleEnable}
          disabled={requesting}
          className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {requesting ? "Enabling..." : "Enable"}
        </button>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="text-xs font-medium text-primary-700 hover:underline"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
