import { db, ref, set, push } from "./firebase";

/* Append-only activity log under /activityLog
 * Each entry: { id, ts, type, text, who, refId? }
 * type values: "order_created", "order_viewed", "field_note", "materials_request",
 *              "recurring_generated", "summary"
 */

export function logActivity({ type, text, who, refId, extra }) {
  try {
    const node = push(ref(db, "activityLog"));
    const entry = {
      id: node.key,
      ts: new Date().toISOString(),
      type: type || "info",
      text: text || "",
      who: who || "",
      refId: refId || "",
      ...(extra || {})
    };
    set(node, entry).catch(() => {});
    return entry;
  } catch (e) {
    return null;
  }
}

export function logConfirmation({ orderId, refId, crewName, members }) {
  try {
    const ts = new Date().toISOString();
    const path = `confirmations/${orderId || refId || "unknown"}/${ts.replace(/[:.]/g, "_")}`;
    set(ref(db, path), { viewedAt: ts, orderRef: refId || "", crewName: crewName || "", members: members || [] }).catch(() => {});
    return ts;
  } catch (e) {
    return null;
  }
}

export function iconFor(type) {
  switch (type) {
    case "order_viewed": return "👁";
    case "field_note": return "📝";
    case "materials_request": return "🔧";
    case "order_created": return "✅";
    case "recurring_generated": return "🔁";
    case "summary": return "📊";
    default: return "•";
  }
}
