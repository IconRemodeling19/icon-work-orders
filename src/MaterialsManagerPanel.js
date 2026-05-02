import React, { useState, useEffect } from "react";
import { db, ref, set } from "./firebase";
import { enhanceMaterialsRequest, AIKeyMissingError } from "./aiClient";

const ff = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const t = {
  bg: "#0D0F1A", card: "#131929", line: "#1E2845", text: "#F0F4FF",
  muted: "#4A5A7A", blue: "#4F7FFF", green: "#4ADE80", amber: "#F59E0B",
  danger: "#F43F5E", purple: "#A78BFA", inputBg: "#0A0D18", tag: "#161D2E"
};

const inputStyle = {
  width: "100%", padding: "10px 12px", background: t.inputBg, border: `1.5px solid ${t.line}`,
  borderRadius: "8px", color: t.text, fontSize: "13px", fontFamily: ff, outline: "none",
  boxSizing: "border-box"
};

export default function MaterialsManagerPanel({ request, aiEnabled, onSetAiEnabled, onClose, showToast }) {
  const [aiList, setAiList] = useState(request?.aiGeneratedList || null);
  const [processing, setProcessing] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Auto-process when the manager opens an unprocessed request and AI is enabled
  useEffect(() => {
    if (!request || !aiEnabled || aiList || processing) return;
    if (!request.lineItems || request.lineItems.length === 0) return;
    setProcessing(true);
    setAiError(null);
    enhanceMaterialsRequest(request.lineItems)
      .then(result => {
        setAiList(result);
        // persist AI result
        set(ref(db, `materialsRequests/${request.id}/aiGeneratedList`), result).catch(() => {});
        set(ref(db, `materialsRequests/${request.id}/aiProcessedAt`), new Date().toISOString()).catch(() => {});
      })
      .catch(err => {
        if (err instanceof AIKeyMissingError) {
          setAiError("AI features require API key configuration");
        } else {
          setAiError(err.message || "AI processing failed");
        }
      })
      .finally(() => setProcessing(false));
  }, [request, aiEnabled, aiList, processing]);

  const updateAiItem = (idx, patch) => {
    const next = aiList.map((it, i) => i === idx ? { ...it, ...patch } : it);
    setAiList(next);
    set(ref(db, `materialsRequests/${request.id}/aiGeneratedList`), next).catch(() => {});
  };

  const removeAiItem = (idx) => {
    const next = aiList.filter((_, i) => i !== idx);
    setAiList(next);
    set(ref(db, `materialsRequests/${request.id}/aiGeneratedList`), next).catch(() => {});
  };

  const saveFinal = () => {
    set(ref(db, `materialsRequests/${request.id}/status`), "approved").catch(() => {});
    set(ref(db, `materialsRequests/${request.id}/finalizedAt`), new Date().toISOString()).catch(() => {});
    showToast?.("Final list saved");
  };

  const printList = () => {
    const items = aiList && aiList.length ? aiList : (request.lineItems || []).map(l => ({ description: l.description, quantity: l.quantity, unit: l.unit, uncertain: false }));
    const w = window.open("", "_blank", "width=800,height=600");
    w.document.write(`<!DOCTYPE html><html><head><title>Materials List — ${request.jobName || ""}</title>
      <style>body{font-family:'Segoe UI',Arial,sans-serif;color:#1F2329;padding:32px;max-width:720px;margin:0 auto;}
      h1{font-size:22px;margin:0 0 4px;letter-spacing:.5px;text-transform:uppercase;color:#000;}
      .sub{font-size:11px;color:#5F6670;letter-spacing:2px;text-transform:uppercase;margin-bottom:24px;}
      .meta{font-size:13px;color:#1F2329;margin-bottom:20px;padding:12px 14px;background:#F2F4F6;border-radius:8px;}
      table{width:100%;border-collapse:collapse;font-size:13px;}
      th{background:#000;color:#fff;text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:1px;}
      td{padding:10px 12px;border-bottom:1px solid #D6D9DE;}
      .qty{text-align:right;font-weight:600;}
      .flag{color:#B45309;font-size:11px;font-weight:700;}
      @media print{@page{margin:0.5in;}}</style></head>
      <body><h1>Icon Remodeling Group Inc.</h1><div class="sub">Materials List</div>
      <div class="meta"><strong>Job:</strong> ${request.jobName || "—"}<br/><strong>Requested by:</strong> ${request.requestedBy || "—"}<br/><strong>Date:</strong> ${(request.submittedAt || "").split("T")[0]}</div>
      <table><thead><tr><th>Description</th><th class="qty">Qty</th><th>Unit</th></tr></thead><tbody>
      ${items.map(it => `<tr><td>${it.description || ""}${it.uncertain ? `<div class="flag">⚠ ${it.note || "Uncertain — please verify"}</div>` : ""}</td><td class="qty">${it.quantity ?? ""}</td><td>${it.unit || ""}</td></tr>`).join("")}
      </tbody></table>
      <div style="margin-top:32px;font-size:10px;color:#5F6670;letter-spacing:1px;text-transform:uppercase;">Designed with Purpose | Built with Pride</div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  if (!request) return null;

  return (
    <div style={{ minHeight: "100vh", background: t.bg, fontFamily: ff }}>
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${t.line}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", background: "#161D2E"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: t.blue, padding: "6px", cursor: "pointer" }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: t.text }}>Materials Request</div>
            <div style={{ fontSize: "11px", color: t.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {request.jobName || "—"} · {request.requestedBy} · {(request.submittedAt || "").split("T")[0]}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: t.muted }}>AI</span>
          <button onClick={() => onSetAiEnabled(!aiEnabled)} style={{
            width: "40px", height: "22px", borderRadius: "13px",
            background: aiEnabled ? t.purple : t.line, border: "none", position: "relative", cursor: "pointer", padding: 0
          }}>
            <span style={{ position: "absolute", top: "2px", left: aiEnabled ? "20px" : "2px", width: "18px", height: "18px", background: "#fff", borderRadius: "50%", transition: "left .15s" }} />
          </button>
        </div>
      </div>

      <div style={{ padding: "20px", maxWidth: "1100px", margin: "0 auto" }}>

        {request.overallNotes && (
          <div style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: "10px", padding: "12px 14px", marginBottom: "16px", fontSize: "13px", color: t.text }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: t.muted, textTransform: "uppercase", letterSpacing: "1px", marginRight: "8px" }}>Notes:</span>{request.overallNotes}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: aiEnabled ? "1fr 1fr" : "1fr", gap: "16px" }}>

          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: t.muted, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "10px" }}>Original Field Submission</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(request.lineItems || []).map((li, i) => (
                <div key={li.id || i} style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: "10px", padding: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "14px", color: t.text, fontWeight: 600, marginBottom: "3px" }}>{li.description}</div>
                      <div style={{ fontSize: "12px", color: t.muted }}>{li.quantity} {li.unit}</div>
                    </div>
                    {li.photoUrl && (
                      <a href={li.photoUrl} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                        <img src={li.photoUrl} alt="" style={{ width: "60px", height: "60px", borderRadius: "8px", objectFit: "cover", border: `1px solid ${t.line}` }} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {aiEnabled && (
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: t.purple, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "10px" }}>✨ AI-Enhanced List</div>
              {processing && <div style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: "10px", padding: "20px", textAlign: "center", color: t.muted, fontSize: "13px" }}>AI is processing...</div>}
              {!processing && aiError && <div style={{ background: "rgba(244,63,94,.05)", border: "1px solid rgba(244,63,94,.25)", borderRadius: "10px", padding: "14px", color: t.danger, fontSize: "13px" }}>{aiError}</div>}
              {!processing && !aiError && aiList && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {aiList.map((it, i) => (
                    <div key={i} style={{ background: t.card, border: `1px solid ${it.uncertain ? "rgba(245,158,11,.4)" : t.line}`, borderRadius: "10px", padding: "12px" }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <input value={it.description || ""} onChange={e => updateAiItem(i, { description: e.target.value })} style={{ ...inputStyle, fontWeight: 600, marginBottom: "6px" }} />
                          <div style={{ display: "flex", gap: "6px" }}>
                            <input type="number" value={it.quantity || ""} onChange={e => updateAiItem(i, { quantity: Number(e.target.value) })} style={{ ...inputStyle, width: "70px" }} />
                            <input value={it.unit || ""} onChange={e => updateAiItem(i, { unit: e.target.value })} placeholder="unit" style={{ ...inputStyle, width: "100px" }} />
                          </div>
                          {it.uncertain && <div style={{ marginTop: "6px", fontSize: "11px", color: t.amber, fontWeight: 600 }}>⚠️ {it.note || "Uncertain — please verify"}</div>}
                        </div>
                        <button onClick={() => removeAiItem(i)} title="Remove" style={{ background: "transparent", border: "none", color: t.danger, cursor: "pointer", padding: "6px", fontSize: "14px", fontWeight: 800 }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
          <button onClick={saveFinal} style={{
            background: "linear-gradient(135deg,#16A34A,#4ADE80)", color: "#051009", border: "none",
            padding: "12px 18px", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: ff
          }}>✓ Save Final List</button>
          <button onClick={printList} style={{
            background: t.tag, border: `1px solid ${t.line}`, color: t.text,
            padding: "12px 18px", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: ff
          }}>🖨 Print / Share</button>
          {request.status === "approved" && <span style={{ alignSelf: "center", fontSize: "12px", color: t.green, fontWeight: 700, padding: "6px 12px", background: "rgba(74,222,128,.1)", borderRadius: "8px" }}>✓ Approved</span>}
        </div>
      </div>
    </div>
  );
}
