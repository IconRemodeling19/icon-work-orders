import React, { useState } from "react";

const ff = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

function pad(n) { return String(n).padStart(2, "0"); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseYMD(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["S","M","T","W","T","F","S"];

/**
 * MiniCalendar — self-contained date picker, no external deps.
 *
 * Props:
 *  - value:  string "YYYY-MM-DD"
 *  - onChange(newValue): called with the YYYY-MM-DD string
 *  - minDate, maxDate (optional): "YYYY-MM-DD"
 *  - allowManualEntry (default true): show a text input fallback
 *  - theme: "dark" (default) or "light"
 */
export default function MiniCalendar({ value, onChange, minDate, maxDate, allowManualEntry = true, theme = "dark" }) {
  const initial = parseYMD(value) || new Date();
  const [view, setView] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(value || "");

  const dark = theme === "dark";
  const c = dark ? {
    bg: "#0A0D18", card: "#131929", line: "#1E2845", text: "#F0F4FF",
    muted: "#4A5A7A", accent: "#4F7FFF", today: "rgba(79,127,255,.15)"
  } : {
    bg: "#fff", card: "#fff", line: "#D6D9DE", text: "#1F2329",
    muted: "#5F6670", accent: "#0077C8", today: "rgba(0,119,200,.1)"
  };

  const startOfMonth = new Date(view.getFullYear(), view.getMonth(), 1);
  const startDow = startOfMonth.getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const todayStr = ymd(new Date());
  const min = parseYMD(minDate);
  const max = parseYMD(maxDate);

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const select = (d) => {
    const picked = new Date(view.getFullYear(), view.getMonth(), d);
    const s = ymd(picked);
    if (min && picked < min) return;
    if (max && picked > max) return;
    setManual(s);
    onChange(s);
    setOpen(false);
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px", background: c.bg,
    border: `1.5px solid ${c.line}`, borderRadius: "10px", color: c.text,
    fontSize: "15px", fontFamily: ff, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: "8px" }}>
        {allowManualEntry && (
          <input
            type="text"
            placeholder="YYYY-MM-DD"
            value={manual}
            onChange={(e) => {
              setManual(e.target.value);
              if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) onChange(e.target.value);
            }}
            style={{ ...inputStyle, flex: 1 }}
          />
        )}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            padding: "12px 14px", background: c.card, border: `1.5px solid ${c.line}`,
            borderRadius: "10px", color: c.text, cursor: "pointer",
            fontSize: "14px", fontWeight: 600, fontFamily: ff,
            display: "flex", alignItems: "center", gap: "6px"
          }}
        >📅 {open ? "Close" : "Pick"}</button>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 1200,
          background: c.card, border: `1.5px solid ${c.line}`, borderRadius: "12px",
          padding: "12px", boxShadow: "0 8px 32px rgba(0,0,0,.4)", maxWidth: "320px"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              style={{ background: "transparent", border: "none", color: c.muted, fontSize: "20px", cursor: "pointer" }}>‹</button>
            <div style={{ fontSize: "14px", fontWeight: 700, color: c.text }}>
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </div>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              style={{ background: "transparent", border: "none", color: c.muted, fontSize: "20px", cursor: "pointer" }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "4px" }}>
            {DOW.map((d, i) => (
              <div key={`dow${i}`} style={{ textAlign: "center", fontSize: "10px", fontWeight: 700, color: c.muted, padding: "4px 0" }}>{d}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const cellDate = new Date(view.getFullYear(), view.getMonth(), d);
              const cellStr = ymd(cellDate);
              const disabled = (min && cellDate < min) || (max && cellDate > max);
              const isToday = cellStr === todayStr;
              const isSelected = cellStr === value;
              return (
                <button
                  type="button"
                  key={`d${d}`}
                  disabled={disabled}
                  onClick={() => select(d)}
                  style={{
                    padding: "8px 0", borderRadius: "6px", border: "none",
                    background: isSelected ? c.accent : isToday ? c.today : "transparent",
                    color: isSelected ? "#fff" : disabled ? c.muted : c.text,
                    fontSize: "13px", fontWeight: isSelected || isToday ? 700 : 500,
                    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
                    fontFamily: ff
                  }}
                >{d}</button>
              );
            })}
          </div>
          <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between" }}>
            <button type="button" onClick={() => { const t = ymd(new Date()); setManual(t); onChange(t); setOpen(false); }}
              style={{ background: "transparent", border: "none", color: c.accent, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Today</button>
            <button type="button" onClick={() => setOpen(false)}
              style={{ background: "transparent", border: "none", color: c.muted, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
