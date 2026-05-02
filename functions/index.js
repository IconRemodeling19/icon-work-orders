/* Firebase Cloud Functions — push notifications fan-out.
 *
 * Deploy separately:
 *   cd functions && npm install
 *   firebase deploy --only functions
 *
 * These functions watch Realtime Database paths the client writes to, then
 * fan-out push notifications to every device token under /notificationTokens.
 *
 * Requires Firebase Admin SDK + functions:
 *   npm install firebase-admin firebase-functions
 *
 * (Stub — wire up once you have a Blaze plan + functions enabled.)
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.database();

// Default audience for manager-targeted alerts. Edit as needed.
const MANAGER_NAMES = ["Joe", "Bryan", "Rob"];

async function getAllTokens() {
  const snap = await db.ref("notificationTokens").once("value");
  const v = snap.val() || {};
  return Object.keys(v);
}

async function sendNotification({ title, body, data }) {
  const tokens = await getAllTokens();
  if (tokens.length === 0) return { sent: 0 };
  const msg = {
    notification: { title, body },
    data: data || {},
    tokens,
  };
  const res = await admin.messaging().sendEachForMulticast(msg);
  return { sent: res.successCount, failed: res.failureCount };
}

// New crew work order — notify everyone
exports.notifyOnNewOrder = functions.database.ref("/orders/{idx}")
  .onCreate(async (snap) => {
    const order = snap.val() || {};
    return sendNotification({
      title: "New work order",
      body: `${order.crewName || "Crew"} — ${order.referenceId || ""}`,
      data: { type: "order_created", refId: order.referenceId || "" }
    });
  });

// Materials request — notify managers (Joe, Bryan, Rob)
exports.notifyOnMaterialsRequest = functions.database.ref("/materialsRequests/{id}")
  .onCreate(async (snap) => {
    const req = snap.val() || {};
    return sendNotification({
      title: "Materials request",
      body: `${req.requestedBy || "Crew"} requested ${(req.lineItems || []).length} item(s)`,
      data: { type: "materials_request", id: snap.key, audience: MANAGER_NAMES.join(",") }
    });
  });

// New field note
exports.notifyOnFieldNote = functions.database.ref("/fieldNotes/{idx}")
  .onCreate(async (snap) => {
    const note = snap.val() || {};
    return sendNotification({
      title: "New field note",
      body: `${note.jobRef || "Job"} — ${note.notes ? note.notes.slice(0, 80) : ""}`,
      data: { type: "field_note" }
    });
  });

// Recurring auto-generation — log + notify managers
exports.notifyOnRecurringGenerated = functions.database.ref("/activityLog/{id}")
  .onCreate(async (snap) => {
    const entry = snap.val() || {};
    if (entry.type !== "recurring_generated") return null;
    return sendNotification({
      title: "Recurring order generated",
      body: entry.text || "",
      data: { type: "recurring_generated", refId: entry.refId || "" }
    });
  });
