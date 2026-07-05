// Firebase Cloud Messaging background service worker. Must live at this exact path (site root)
// for FCM's default registration scope. Config values here are the NEXT_PUBLIC_ ones — safe to
// expose since they're already shipped in the client bundle.
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDpnKeUMEMHykLE0S78G24mE8kC0RlvgvM",
  authDomain: "skola-alumni.firebaseapp.com",
  projectId: "skola-alumni",
  storageBucket: "skola-alumni.firebasestorage.app",
  messagingSenderId: "787768684196",
  appId: "1:787768684196:web:fd9715d80e980942a94031",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  const link = payload.data?.link;

  self.registration.showNotification(title ?? "Skola Alumni", {
    body,
    icon: "/icon-192.png",
    data: { link },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? "/";
  event.waitUntil(self.clients.openWindow(link));
});
