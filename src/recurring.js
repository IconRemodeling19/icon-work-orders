/* Recurring work order helpers */

export const FREQUENCIES = ["Daily", "Weekly", "Bi-Weekly", "Monthly"];

function dateOnly(d) {
  if (!d) return null;
  const dt = (d instanceof Date) ? new Date(d) : new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return null;
  return dt;
}

function fmt(d) {
  // YYYY-MM-DD in local time
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function nextDate(currentDateStr, frequency) {
  const d = dateOnly(currentDateStr);
  if (!d) return null;
  const out = new Date(d);
  switch (frequency) {
    case "Daily":     out.setDate(out.getDate() + 1); break;
    case "Weekly":    out.setDate(out.getDate() + 7); break;
    case "Bi-Weekly": out.setDate(out.getDate() + 14); break;
    case "Monthly":   out.setMonth(out.getMonth() + 1); break;
    default: return null;
  }
  return fmt(out);
}

export function todayStr() {
  return fmt(new Date());
}

/** Templates due to be auto-generated today (or earlier). */
export function dueTemplates(templates, today) {
  const t = today || todayStr();
  return Object.entries(templates || {})
    .filter(([_, tpl]) => {
      if (!tpl?.recurring?.enabled) return false;
      if (tpl.stopped) return false;
      const next = tpl.nextScheduledDate || tpl.recurring?.startDate || tpl.date;
      if (!next) return false;
      if (tpl.recurring?.until && next > tpl.recurring.until) return false;
      return next <= t;
    })
    .map(([id, tpl]) => ({ id, tpl }));
}

/** Build a fresh order from a template, dated `dateStr`. */
export function orderFromTemplate(template, dateStr, generateRefIdFn) {
  const order = {
    crewName: template.crewName || "",
    members: [...(template.members || [])],
    date: dateStr,
    jobs: (template.jobs || []).map(j => ({ ...j, attachments: [...(j.attachments || [])] })),
    referenceId: generateRefIdFn ? generateRefIdFn(template) : undefined,
    fromRecurringTemplate: template.id || null,
    lastModified: new Date().toISOString(),
  };
  return order;
}
