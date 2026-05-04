import React, { useState } from "react";
import { db, ref, set, push, storage, storageRef, uploadBytes, getDownloadURL } from "./firebase";
import { logActivity } from "./historyLog";
import { localNotify } from "./notifications";

const ff = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const t = {
  bg: "#0D0F1A", card: "#131929", line: "#1E2845", text: "#F0F4FF",
  muted: "#4A5A7A", blue: "#4F7FFF", green: "#4ADE80", amber: "#F59E0B",
  danger: "#F43F5E", purple: "#A78BFA", inputBg: "#0A0D18", tag: "#161D2E"
};

const UNITS = ["each", "box", "bag", "sheet", "LF", "SF", "gallon", "lb", "other"];

const inputStyle = {
  width: "100%", padding: "12px 14px", background: t.inputBg, border: `1.5px solid ${t.line}`,
  borderRadius: "10px", color: t.text, fontSize: "16px", fontFamily: ff, outline: "none",
  boxSizing: "border-box"
};
const labelStyle = {
  display: "block", fontSize: "11px", fontWeight: 700, color: t.muted,
  textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "6px"
};

const emptyLine = () => ({ id: `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, description: "", quantity: 1, unit: "each", photoUrl: "" });

export default function MaterialsRequestForm({ activeJobs, members, onClose, onSubmitted, showToast }) {
  const [jobIndex, setJobIndex] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [lineItems, setLineItems] = useState([emptyLine()]);
  const [overallNotes, setOverallNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState(null);

  const updateLine = (idx, patch) => setLineItems(items => items.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const addLine = () => setLineItems(items => [...items, emptyLine()]);
  const removeLine = (idx) => setLineItems(items => items.length === 1 ? items : items.filter((_, i) => i !== idx));

  const handlePhoto = async (idx, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIdx(idx);
    try {
      const fn = `${Date.now()}_${file.name}`;
      const fr = storageRef(storage, `materials/${fn}`);
      await uploadBytes(fr, file);
      const url = await getDownloadURL(fr);
      updateLine(idx, { photoUrl: url, photoName: file.name });
    } catch (err) {
      showToast?.("Photo upload failed");
    } finally {
      setUploadingIdx(null);
      e.target.value = "";
    }
  };

  const submit = async () => {
    const valid = lineItems.filter(l => l.description.trim());
    if (valid.length === 0) { showToast?.("Add at least one item"); return; }
    if (!requestedBy) { showToast?.("Select who is requesting"); return; }
    setSubmitting(true);
    try {
      const job = activeJobs[Number(jobIndex)];
      const node = push(ref(db, "materialsRequests"));
      const id = node.key;
      const now = new Date().toISOString();
      const record = {
        id,
        submittedAt: now,
        requestedBy,
        jobIndex: jobIndex !== "" ? Number(jobIndex) : null,
        jobName: job?.name || "",
        jobAddress: job?.address || "",
        customerName: job?.customerName || "",
        lineItems: valid.map(l => ({
          id: l.id, description: l.description.trim(),
          quantity: Number(l.quantity) || 1, unit: l.unit || "each",
          photoUrl: l.photoUrl || "", photoName: l.photoName || ""
        })),
        overallNotes: overallNotes.trim(),
        status: "pending",
        aiGeneratedList: null,
        aiProcessedAt: null,
      };
      await set(node, record);
      logActivity({
        type: "materials_request",
        who: requestedBy,
        text: `Materials request submitted by ${requestedBy}${job?.name ? ` for ${job.name}` : ""} · ${valid.length} item${valid.length === 1 ? "" : "s"}`,
        extra: { materialsId: id }
      });
      localNotify("New materials request", `${requestedBy} requested ${valid.length} item(s)`);
      showToast?.("Materials request sent");
      onSubmitted?.(record);
    } catch (e) {
      console.error(e);
      showToast?.("Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, fontFamily: ff }}>
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${t.line}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", background: "#161D2E"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: t.blue, padding: "10px", minWidth: "44px", minHeight: "44px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: ff }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: t.text }}>Materials Request</div>
            <div style={{ fontSize: "11px", color: t.muted }}>Field crew → Manager</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px", maxWidth: "640px", margin: "0 auto", paddingBottom: "100px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          <div>
            <label style={labelStyle}>Linked Job</label>
            <select value={jobIndex} onChange={e => setJobIndex(e.target.value)} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
              <option value="">— Select a job (optional) —</option>
              {(activeJobs || []).map((j, i) => <option key={i} value={i}>{j.name}{j.customerName ? ` · ${j.customerName}` : ""}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Requested By</label>
            <select value={requestedBy} onChange={e => setRequestedBy(e.target.value)} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
              <option value="">— Who is requesting —</option>
              {(members || []).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Line Items</label>
              <span style={{ fontSize: "11px", color: t.muted }}>{lineItems.length} item{lineItems.length === 1 ? "" : "s"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {lineItems.map((line, idx) => (
                <div key={line.id} style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: "12px", padding: "12px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ flex: 1 }}>
                      <input value={line.description} onChange={e => updateLine(idx, { description: e.target.value })} placeholder={`Item #${idx + 1} description`} style={inputStyle} />
                    </div>
                    <button onClick={() => removeLine(idx)} title="Remove" style={{ background: "transparent", border: "none", color: t.danger, cursor: "pointer", padding: "12px 12px", minWidth: "44px", minHeight: "44px", fontSize: "16px", fontWeight: 800 }}>✕</button>
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ flex: 1 }}>
                      <input type="number" min="0" step="1" value={line.quantity} onChange={e => updateLine(idx, { quantity: e.target.value })} placeholder="Qty" style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <select value={line.unit} onChange={e => updateLine(idx, { unit: e.target.value })} style={{ ...inputStyle, appearance: "none" }}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input type="file" accept="image/*" capture="environment" id={`photo-${line.id}`} style={{ display: "none" }} onChange={e => handlePhoto(idx, e)} />
                    <button type="button" onClick={() => document.getElementById(`photo-${line.id}`)?.click()} disabled={uploadingIdx === idx} style={{ background: t.tag, border: `1px solid ${t.line}`, color: t.text, padding: "12px 14px", minHeight: "44px", fontSize: "14px", borderRadius: "8px", cursor: "pointer", fontFamily: ff, fontWeight: 600 }}>
                      📷 {uploadingIdx === idx ? "Uploading..." : line.photoUrl ? "Replace photo" : "Add photo"}
                    </button>
                    {line.photoUrl && (
                      <img src={line.photoUrl} alt="" style={{ width: "40px", height: "40px", borderRadius: "6px", objectFit: "cover", border: `1px solid ${t.line}` }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addLine} style={{
              width: "100%", marginTop: "10px", padding: "12px", minHeight: "44px",
              background: "transparent", border: `2px dashed ${t.line}`, color: t.muted,
              borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: ff
            }}>+ Add Item</button>
          </div>

          <div>
            <label style={labelStyle}>Overall Notes (optional)</label>
            <textarea value={overallNotes} onChange={e => setOverallNotes(e.target.value)} placeholder="Any additional context for the manager..." rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: "70px" }} />
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "14px", minHeight: "44px", background: t.tag, border: `1px solid ${t.line}`, color: t.muted,
              borderRadius: "10px", fontWeight: 600, fontSize: "14px", cursor: "pointer", fontFamily: ff
            }}>Cancel</button>
            <button onClick={submit} disabled={submitting} style={{
              flex: 2, padding: "14px", minHeight: "44px",
              background: "linear-gradient(135deg,#3B6FEF,#5B9BFF)", color: "#fff",
              border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "16px",
              cursor: submitting ? "not-allowed" : "pointer", fontFamily: ff,
              opacity: submitting ? 0.6 : 1
            }}>{submitting ? "Submitting..." : "Submit Request"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
