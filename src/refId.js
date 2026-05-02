/* Work Order reference ID helpers
 * Format: WO-[JOBNAME]-[XXX]   e.g. WO-SHAKE-047, WO-MARCH-183
 */

function jobNameFromOrder(order) {
  const jobs = order?.jobs || [];
  const first = jobs[0] || {};
  const candidate =
    first.jobTreadName ||
    order?.jobTreadName ||
    first.customerName ||
    order?.customerName ||
    first.jobAddress ||
    order?.jobAddress ||
    "WO";
  const word = String(candidate).trim().split(/\s+/)[0] || "WO";
  return word.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6) || "WO";
}

export function generateReferenceId(order) {
  const job = jobNameFromOrder(order);
  const num = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `WO-${job}-${num}`;
}

/** If `order.referenceId` is missing, generate one and persist it via `save`. */
export function ensureReferenceId(order, save) {
  if (order?.referenceId) return order.referenceId;
  const id = generateReferenceId(order);
  if (typeof save === "function") {
    try { save(id); } catch (e) { /* swallow — best effort */ }
  }
  return id;
}
