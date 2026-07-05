import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { inArray, and, eq } from "drizzle-orm";
import { getFirebaseAdminEnv } from "@/config/env";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

let app: App | null = null;

function getFirebaseAdminApp(): App {
  if (app) return app;

  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }

  const serviceAccount = JSON.parse(getFirebaseAdminEnv().FIREBASE_SERVICE_ACCOUNT_JSON);
  app = initializeApp({ credential: cert(serviceAccount) });
  return app;
}

interface PushPayload {
  title: string;
  body: string;
  link?: string;
}

/**
 * Sends a push notification to every device registered to the given users. Silently drops tokens
 * Firebase reports as invalid/unregistered (device uninstalled the app, token rotated, etc.) — cleans
 * them up so future sends don't keep retrying dead tokens.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return;

  const subscriptions = await db
    .select({ id: pushSubscriptions.id, fcmToken: pushSubscriptions.fcmToken })
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds));

  if (subscriptions.length === 0) return;

  const messaging = getMessaging(getFirebaseAdminApp());

  const response = await messaging.sendEachForMulticast({
    tokens: subscriptions.map((s) => s.fcmToken),
    notification: { title: payload.title, body: payload.body },
    webpush: payload.link ? { fcmOptions: { link: payload.link } } : undefined,
  });

  const deadTokenIds: string[] = [];
  response.responses.forEach((result, index) => {
    if (!result.success && result.error?.code === "messaging/registration-token-not-registered") {
      deadTokenIds.push(subscriptions[index].id);
    }
  });

  if (deadTokenIds.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, deadTokenIds));
  }
}

export async function removePushSubscription(userId: string, fcmToken: string) {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.fcmToken, fcmToken), eq(pushSubscriptions.userId, userId)));
}
