import { db, ref, set, onValue, getMessagingIfSupported } from "./firebase";

// REPLACE with your real VAPID key from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates.
// Until this is set, getToken() will fail silently and notifications will be a no-op.
const VAPID_KEY = ""; // e.g. "BJ7p..."

/**
 * Request notification permission and register the FCM token.
 * Returns the token string, or null if not supported / denied.
 */
export async function requestPermissionAndRegisterToken() {
  if (typeof Notification === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  try {
    const messaging = await getMessagingIfSupported();
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const reg = await navigator.serviceWorker.ready;
    const { getToken, onMessage } = await import("firebase/messaging");

    if (!VAPID_KEY) {
      console.info("[notifications] VAPID key not configured — skipping token registration. Set VAPID_KEY in src/notifications.js.");
      return null;
    }

    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return null;

    await set(ref(db, `notificationTokens/${token}`), {
      registeredAt: new Date().toISOString(),
      ua: navigator.userAgent.slice(0, 200)
    });

    onMessage(messaging, (payload) => {
      // Foreground messages — show a soft in-page notice.
      try {
        const title = payload.notification?.title || "Icon Remodeling";
        const body = payload.notification?.body || "";
        new Notification(title, { body, icon: "/icon-192.png" });
      } catch (e) { /* ignore */ }
    });

    return token;
  } catch (e) {
    console.warn("Notification setup failed:", e);
    return null;
  }
}

/**
 * Fire a local browser notification (works without a server).
 * For real push, the Cloud Function in /functions/index.js fans out to FCM tokens.
 */
export function localNotify(title, body) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/icon-192.png" });
    }
  } catch (e) { /* ignore */ }
}

export function listTokens(cb) {
  return onValue(ref(db, "notificationTokens"), (s) => cb(s.val() || {}));
}
