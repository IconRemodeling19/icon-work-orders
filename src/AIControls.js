import React, { useState, useRef, useEffect } from "react";
import { generateJobDescription, suggestMaterials, voiceToOrder, AIKeyMissingError } from "./aiClient";

const ff = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const t = {
  card: "#131929", line: "#1E2845", text: "#F0F4FF", muted: "#4A5A7A",
  blue: "#4F7FFF", purple: "#A78BFA", danger: "#F43F5E", inputBg: "#0A0D18", tag: "#161D2E"
};

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 1500,
  display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
};
const modalStyle = {
  background: t.card, border: `1px solid ${t.line}`, borderRadius: "16px",
  padding: "24px", maxWidth: "520px", width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,.6)",
  fontFamily: ff
};
const inputStyle = {
  width: "100%", padding: "12px 14px", background: t.inputBg, border: `1.5px solid ${t.line}`,
  borderRadius: "10px", color: t.text, fontSize: "14px", fontFamily: ff, outline: "none", boxSizing: "border-box"
};

function ErrorMsg({ msg }) {
  if (!msg) return null;
  return <div style={{ marginTop: "12px", padding: "10px 14px", background: "rgba(244,63,94,.08)", border: "1px solid rgba(244,63,94,.3)", borderRadius: "8px", fontSize: "13px", color: t.danger }}>{msg}</div>;
}

export function AIPillButton({ onClick, label = "Generate", color = t.purple, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      background: disabled ? t.tag : `${color}22`, color: disabled ? t.muted : color,
      border: `1px solid ${disabled ? t.line : `${color}55`}`,
      padding: "5px 10px", borderRadius: "16px", fontSize: "11px", fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer", fontFamily: ff
    }}>✨ {label}</button>
  );
}

/** Dialog: prompt manager for a short input → AI generates a long-form bullet list. */
export function GenerateDescriptionDialog({ onUse, onEditAndUse, onClose }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const run = async () => {
    if (!input.trim()) return;
    setLoading(true); setError("");
    try {
      const text = await generateJobDescription(input.trim());
      setOutput(text);
    } catch (e) {
      setError(e instanceof AIKeyMissingError ? "AI features require API key configuration" : e.message || "AI request failed");
    } finally { setLoading(false); }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: "16px", fontWeight: 700, color: t.text, marginBottom: "4px" }}>✨ Generate Job Description</div>
        <div style={{ fontSize: "12px", color: t.muted, marginBottom: "14px" }}>Describe the job in a few words. Example: "bathroom tile demo and install, 12x24 porcelain"</div>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") run(); }} placeholder="bathroom tile demo and install, 12x24 porcelain" style={inputStyle} autoFocus />
        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", background: t.tag, border: `1px solid ${t.line}`, color: t.muted, borderRadius: "8px", fontWeight: 600, cursor: "pointer", fontFamily: ff }}>Cancel</button>
          <button onClick={run} disabled={!input.trim() || loading} style={{ flex: 2, padding: "10px", background: loading ? t.tag : t.purple, color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, cursor: loading ? "wait" : "pointer", fontFamily: ff, opacity: !input.trim() ? 0.5 : 1 }}>{loading ? "Generating..." : "Generate"}</button>
        </div>

        <ErrorMsg msg={error} />

        {output && (
          <div style={{ marginTop: "16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: t.purple, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Preview</div>
            <textarea value={output} onChange={e => setOutput(e.target.value)} rows={Math.min(12, Math.max(4, output.split("\n").length + 1))} style={{ ...inputStyle, resize: "vertical", fontSize: "13px", lineHeight: 1.5 }} />
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button onClick={() => { onEditAndUse(output); onClose(); }} style={{ flex: 1, padding: "10px", background: t.tag, border: `1px solid ${t.line}`, color: t.text, borderRadius: "8px", fontWeight: 600, cursor: "pointer", fontFamily: ff }}>Edit Before Using</button>
              <button onClick={() => { onUse(output); onClose(); }} style={{ flex: 1, padding: "10px", background: t.blue, border: "none", color: "#fff", borderRadius: "8px", fontWeight: 700, cursor: "pointer", fontFamily: ff }}>Use This</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SuggestMaterialsDialog({ jobDescription, onUse, onEditAndUse, onClose }) {
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!jobDescription) return;
    setLoading(true); setError("");
    suggestMaterials(jobDescription)
      .then(text => { if (!cancelled) setOutput(text); })
      .catch(e => { if (!cancelled) setError(e instanceof AIKeyMissingError ? "AI features require API key configuration" : e.message || "AI request failed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jobDescription]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: "16px", fontWeight: 700, color: t.text, marginBottom: "4px" }}>✨ Suggest Materials</div>
        <div style={{ fontSize: "12px", color: t.muted, marginBottom: "14px" }}>Based on your job description, here's a suggested materials list.</div>

        {loading && <div style={{ padding: "20px", textAlign: "center", color: t.muted, fontSize: "13px" }}>Thinking...</div>}
        <ErrorMsg msg={error} />

        {output && !loading && (
          <>
            <textarea value={output} onChange={e => setOutput(e.target.value)} rows={Math.min(14, Math.max(4, output.split("\n").length + 1))} style={{ ...inputStyle, resize: "vertical", fontSize: "13px", lineHeight: 1.5 }} />
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button onClick={onClose} style={{ flex: 1, padding: "10px", background: t.tag, border: `1px solid ${t.line}`, color: t.muted, borderRadius: "8px", fontWeight: 600, cursor: "pointer", fontFamily: ff }}>Cancel</button>
              <button onClick={() => { onEditAndUse(output); onClose(); }} style={{ flex: 1, padding: "10px", background: t.tag, border: `1px solid ${t.line}`, color: t.text, borderRadius: "8px", fontWeight: 600, cursor: "pointer", fontFamily: ff }}>Edit Before Using</button>
              <button onClick={() => { onUse(output); onClose(); }} style={{ flex: 1, padding: "10px", background: t.blue, border: "none", color: "#fff", borderRadius: "8px", fontWeight: 700, cursor: "pointer", fontFamily: ff }}>Use This</button>
            </div>
          </>
        )}
        {!loading && !output && !error && (
          <div style={{ padding: "20px", textAlign: "center", color: t.muted, fontSize: "13px" }}>No description provided.</div>
        )}
      </div>
    </div>
  );
}

export function VoiceToOrderDialog({ onApply, onClose, showToast }) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let final = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      setTranscript(final + interim);
    };
    rec.onerror = (e) => { setError(`Voice error: ${e.error || "unknown"}`); setListening(false); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.stop(); } catch (e) {} };
  }, []);

  const start = () => { setError(""); setTranscript(""); try { recRef.current?.start(); setListening(true); } catch (e) { setError("Couldn't start microphone"); } };
  const stop = () => { try { recRef.current?.stop(); } catch (e) {} setListening(false); };

  const parse = async () => {
    if (!transcript.trim()) return;
    setParsing(true); setError("");
    try {
      const fields = await voiceToOrder(transcript.trim());
      const filled = Object.entries(fields).filter(([_, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)).map(([k]) => k);
      onApply(fields);
      showToast?.(`Filled in: ${filled.join(", ")}`);
      onClose();
    } catch (e) {
      setError(e instanceof AIKeyMissingError ? "AI features require API key configuration" : e.message || "Parsing failed");
    } finally { setParsing(false); }
  };

  if (!supported) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={modalStyle} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: t.text, marginBottom: "8px" }}>🎤 Voice Input Not Supported</div>
          <div style={{ fontSize: "13px", color: t.muted, marginBottom: "16px" }}>Your browser doesn't support the Web Speech API. Try the latest Chrome or Safari.</div>
          <button onClick={onClose} style={{ width: "100%", padding: "10px", background: t.tag, border: `1px solid ${t.line}`, color: t.text, borderRadius: "8px", fontWeight: 600, cursor: "pointer", fontFamily: ff }}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: "16px", fontWeight: 700, color: t.text, marginBottom: "4px" }}>🎤 Voice Input</div>
        <div style={{ fontSize: "12px", color: t.muted, marginBottom: "14px" }}>Describe the work order out loud. AI will fill in the matching fields.</div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: "20px", background: t.tag, borderRadius: "10px", marginBottom: "12px" }}>
          {listening ? (
            <button onClick={stop} style={{ display: "flex", alignItems: "center", gap: "10px", background: t.danger, color: "#fff", border: "none", padding: "12px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: ff }}>
              <span style={{ width: "10px", height: "10px", background: "#fff", borderRadius: "50%", animation: "pulse 1s infinite" }} />
              Stop Recording
            </button>
          ) : (
            <button onClick={start} style={{ background: t.purple, color: "#fff", border: "none", padding: "12px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: ff }}>
              🎤 Start Recording
            </button>
          )}
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}`}</style>

        <textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Transcript will appear here..." rows={5} style={{ ...inputStyle, resize: "vertical" }} />

        <ErrorMsg msg={error} />

        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", background: t.tag, border: `1px solid ${t.line}`, color: t.muted, borderRadius: "8px", fontWeight: 600, cursor: "pointer", fontFamily: ff }}>Cancel</button>
          <button onClick={parse} disabled={!transcript.trim() || parsing} style={{ flex: 2, padding: "10px", background: parsing ? t.tag : t.blue, color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, cursor: !transcript.trim() ? "not-allowed" : parsing ? "wait" : "pointer", fontFamily: ff, opacity: !transcript.trim() ? 0.5 : 1 }}>{parsing ? "Parsing..." : "Fill Form"}</button>
        </div>
      </div>
    </div>
  );
}
