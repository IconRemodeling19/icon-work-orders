import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, push, update, remove, goOffline, goOnline } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

/* ─────────────────────────────────────────────────────────────────────────────
 * SECURITY RULES — apply manually in the Firebase Console
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Realtime Database rules → see /firebase.rules.json (paste into
 *   Firebase Console → Realtime Database → Rules).
 *
 *   Cloud Storage rules → see /storage.rules (paste into
 *   Firebase Console → Storage → Rules).
 *
 *   The rules require `auth != null`. The app uses signInAnonymously, which
 *   creates an authenticated session, so end users still pass.
 *
 *   subOrders/{orderId} is intentionally public-readable so subcontractor
 *   share links work for unauthenticated visitors. Writes still require auth.
 *
 *   Cloud Functions for FCM — see /functions/index.js. Deploy with:
 *     firebase deploy --only functions
 *
 *   Note on offline: the Realtime Database web SDK does NOT have
 *   `.enablePersistence()` (that's a Firestore API). The web SDK has an
 *   in-memory cache and queues writes while offline, replaying them on
 *   reconnect. We expose goOffline/goOnline below so the app can react to
 *   navigator.onLine state changes if needed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const firebaseConfig = {
  apiKey: "AIzaSyDwSR8OG2WOJAXn45DPI5jy0dmZhkRylEY",
  authDomain: "icon-work-orders.firebaseapp.com",
  databaseURL: "https://icon-work-orders-default-rtdb.firebaseio.com",
  projectId: "icon-work-orders",
  storageBucket: "icon-work-orders.firebasestorage.app",
  messagingSenderId: "398209180761",
  appId: "1:398209180761:web:9a820bf3f4be2c88bc7d48"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Lazy-load messaging only if the browser supports it.
// FCM in Safari is iOS 16.4+ and only when the PWA is installed.
let _messaging = null;
async function getMessagingIfSupported() {
  if (_messaging) return _messaging;
  try {
    const { isSupported, getMessaging } = await import("firebase/messaging");
    if (await isSupported()) {
      _messaging = getMessaging(app);
      return _messaging;
    }
  } catch (e) { console.error('[firebase:getMessagingIfSupported]', e); }
  return null;
}

export {
  app, db, ref, set, onValue, push, update, remove,
  storage, storageRef, uploadBytes, getDownloadURL,
  auth, signInAnonymously, onAuthStateChanged,
  goOffline, goOnline, getMessagingIfSupported
};
