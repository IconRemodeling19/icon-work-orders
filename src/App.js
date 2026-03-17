import React, { useState, useEffect, useCallback, useRef } from "react";

const GOOGLE_API_KEY = "AIzaSyDP9N998QacTADs3UaDYBohltD3rfflMmE";

const LOGO_SRC = "data:image/jpeg;base64,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";

const DEFAULT_CREWS = {
  "Crew 1": ["Luis", "Azael", "Oswaldo", "Andres", "Vicente", "Gabriel", "Geovanny"],
  "Crew 2": [], "Crew 3": [], "Crew 4": [], "Crew 5": [],
};

const emptyOrder = { crewName: "", members: [], jobAddress: "", jobDescription: "", materials: "", specialNotes: "", date: new Date().toISOString().split("T")[0] };

function loadData(key, fallback) {
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; } catch { return fallback; }
}
function saveData(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.error("Save failed:", e); }
}

const PlusIcon = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>;
const BackIcon = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>;
const TrashIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>;
const EditIcon = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const MapIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const CheckIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>;
const SettingsIcon = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
const SearchIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>;

function getMapsUrl(address) {
  const encoded = encodeURIComponent(address);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isIOS ? `maps://maps.apple.com/?q=${encoded}` : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}

// ── Address Input with Places API (New) ──
function AddressInput({ value, onChange, style }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) { setLoaded(true); return; }
    const existing = document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"]`);
    if (existing) { existing.addEventListener("load", () => setLoaded(true)); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&loading=async`;
    script.async = true; script.defer = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (loaded && window.google && window.google.maps && window.google.maps.places) {
      try { setSessionToken(new window.google.maps.places.AutocompleteSessionToken()); } catch(e) {}
    }
  }, [loaded]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback((input) => {
    if (!loaded || !input || input.length < 3) { setSuggestions([]); return; }
    if (!window.google || !window.google.maps || !window.google.maps.places) return;

    try {
      const service = new window.google.maps.places.AutocompleteService();
      service.getPlacePredictions(
        { input, types: ["address"], componentRestrictions: { country: "us" }, sessionToken },
        (predictions, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(predictions.map(p => ({ description: p.description, placeId: p.place_id })));
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
          }
        }
      );
    } catch(e) {
      console.error("Places error:", e);
    }
  }, [loaded, sessionToken]);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(e);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (desc) => {
    onChange({ target: { value: desc } });
    setShowSuggestions(false);
    setSuggestions([]);
    try { setSessionToken(new window.google.maps.places.AutocompleteSessionToken()); } catch(e) {}
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input type="text" value={value} onChange={handleChange} onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
        placeholder="Start typing an address..." style={style} />
      {showSuggestions && suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1.5px solid #E4E4E7", borderRadius: "0 0 10px 10px", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 100, maxHeight: "200px", overflowY: "auto" }}>
          {suggestions.map((s, i) => (
            <div key={i} onClick={() => handleSelect(s.description)}
              style={{ padding: "12px 16px", cursor: "pointer", fontSize: "14px", borderBottom: i < suggestions.length - 1 ? "1px solid #F0F0F2" : "none", display: "flex", alignItems: "center", gap: "8px" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#F7F7F8"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}>
              <SearchIcon />{s.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState(null);
  const [orders, setOrders] = useState(() => loadData("wo-orders", []));
  const [crews, setCrews] = useState(() => loadData("wo-crews", DEFAULT_CREWS));
  const [selectedCrew, setSelectedCrew] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [formData, setFormData] = useState({ ...emptyOrder });
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [manageCrews, setManageCrews] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [editingCrewName, setEditingCrewName] = useState(null);

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); }, []);

  const handleSave = () => {
    if (!formData.crewName || !formData.jobAddress) { showToast("Crew and address required"); return; }
    let updated;
    if (editingOrder !== null) { updated = orders.map((o, i) => (i === editingOrder ? { ...formData } : o)); }
    else { updated = [...orders, { ...formData }]; }
    setOrders(updated); saveData("wo-orders", updated);
    setShowForm(false); setEditingOrder(null); setFormData({ ...emptyOrder });
    showToast(editingOrder !== null ? "Work order updated" : "Work order created");
  };

  const handleDelete = (index) => {
    const updated = orders.filter((_, i) => i !== index);
    setOrders(updated); saveData("wo-orders", updated); setDeleteConfirm(null); showToast("Work order deleted");
  };

  const addMember = (crew) => {
    if (!newMemberName.trim()) return;
    const updated = { ...crews, [crew]: [...(crews[crew] || []), newMemberName.trim()] };
    setCrews(updated); saveData("wo-crews", updated); setNewMemberName(""); showToast(`${newMemberName.trim()} added`);
  };

  const removeMember = (crew, idx) => {
    const updated = { ...crews, [crew]: crews[crew].filter((_, i) => i !== idx) };
    setCrews(updated); saveData("wo-crews", updated); showToast("Member removed");
  };

  const toggleMember = (name) => {
    setFormData((prev) => ({ ...prev, members: prev.members.includes(name) ? prev.members.filter((n) => n !== name) : [...prev.members, name] }));
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const todayOrders = orders.filter((o) => o.date === todayStr);
  const crewOrders = selectedCrew ? todayOrders.filter((o) => o.crewName === selectedCrew) : [];
  const crewNames = Object.keys(crews);

  const t = { bg: "#FFFFFF", card: "#F7F7F8", accent: "#1A1A1A", accentLight: "#444", text: "#1A1A1A", textMuted: "#71717A", border: "#E4E4E7", danger: "#DC2626", inputBg: "#FFFFFF", tag: "#F0F0F2" };

  const baseBtn = { border: "none", borderRadius: "10px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, transition: "all 0.15s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" };
  const primaryBtn = { ...baseBtn, background: t.accent, color: "#fff", padding: "14px 24px", fontSize: "15px" };
  const ghostBtn = { ...baseBtn, background: "transparent", color: t.textMuted, padding: "10px 16px", fontSize: "14px" };
  const inputStyle = { width: "100%", padding: "14px 16px", background: t.inputBg, border: `1.5px solid ${t.border}`, borderRadius: "10px", color: t.text, fontSize: "15px", fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: "11px", fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "8px" };

  const Logo = ({ size = 60 }) => <img src={LOGO_SRC} alt="Icon Remodeling Group" style={{ width: size, height: "auto", objectFit: "contain" }} />;

  if (mode === null) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <Logo size={80} />
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", color: t.text, margin: "16px 0 0" }}>Work Orders</h1>
          <p style={{ color: t.textMuted, fontSize: "14px", marginTop: "6px" }}>Create and view daily crew assignments</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "320px" }}>
          {[{ key: "manager", label: "Manager", sub: "Create & manage work orders" }, { key: "crew", label: "Crew", sub: "View today's assignments" }].map((item) => (
            <button key={item.key} onClick={() => setMode(item.key)} style={{ ...baseBtn, background: t.card, border: `1.5px solid ${t.border}`, padding: "22px 20px", borderRadius: "14px", flexDirection: "column", gap: "6px", color: t.text }}>
              <span style={{ fontSize: "17px", fontWeight: 700 }}>{item.label}</span>
              <span style={{ fontSize: "13px", color: t.textMuted, fontWeight: 400 }}>{item.sub}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (mode === "crew") {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "'DM Sans', sans-serif" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
        <div style={{ padding: "16px 20px", borderBottom: `1.5px solid ${t.border}`, display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => { setMode(null); setSelectedCrew(null); }} style={{ ...ghostBtn, padding: "8px" }}><BackIcon /></button>
          <Logo size={36} />
          <div><div style={{ fontSize: "16px", fontWeight: 700, color: t.text }}>Crew View</div><div style={{ fontSize: "12px", color: t.textMuted }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div></div>
        </div>
        <div style={{ padding: "20px" }}>
          {!selectedCrew ? (
            <>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", color: t.text, margin: "0 0 16px" }}>Select Your Crew</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {crewNames.map((crew) => { const count = todayOrders.filter((o) => o.crewName === crew).length; return (
                  <button key={crew} onClick={() => setSelectedCrew(crew)} style={{ ...baseBtn, background: t.card, border: `1.5px solid ${t.border}`, padding: "18px 20px", borderRadius: "12px", justifyContent: "space-between", color: t.text, fontSize: "16px" }}>
                    <span style={{ fontWeight: 600 }}>{crew}</span>
                    {count > 0 ? <span style={{ fontSize: "12px", background: t.accent, color: "#fff", padding: "4px 10px", borderRadius: "20px", fontWeight: 700 }}>{count} order{count > 1 ? "s" : ""}</span> : <span style={{ fontSize: "12px", color: t.textMuted }}>No orders</span>}
                  </button>); })}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setSelectedCrew(null)} style={{ ...ghostBtn, padding: "0", marginBottom: "16px", fontSize: "13px" }}><BackIcon /> All Crews</button>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", color: t.text, margin: "0 0 16px" }}>{selectedCrew}</h2>
              {crewOrders.length === 0 ? <div style={{ textAlign: "center", padding: "48px 20px", color: t.textMuted }}><p style={{ fontSize: "16px" }}>No work orders for today</p></div>
              : <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {crewOrders.map((order, idx) => (
                    <div key={idx} style={{ background: t.card, border: `1.5px solid ${t.border}`, borderRadius: "14px", padding: "20px" }}>
                      <div style={{ borderLeft: `3px solid ${t.accent}`, paddingLeft: "14px", marginBottom: "16px" }}>
                        <a href={getMapsUrl(order.jobAddress)} target="_blank" rel="noopener noreferrer" style={{ fontSize: "17px", fontWeight: 700, color: t.text, textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>{order.jobAddress} <MapIcon /></a>
                      </div>
                      {order.members && order.members.length > 0 && <div style={{ marginBottom: "14px" }}><div style={labelStyle}>Assigned</div><div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>{order.members.map((m) => <span key={m} style={{ background: t.tag, color: t.text, padding: "4px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: 600 }}>{m}</span>)}</div></div>}
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div><div style={labelStyle}>Job Description</div><div style={{ color: t.text, fontSize: "14px", lineHeight: 1.6 }}>{order.jobDescription || "\u2014"}</div></div>
                        <div><div style={labelStyle}>Materials Required</div><div style={{ color: t.text, fontSize: "14px", lineHeight: 1.6 }}>{order.materials || "\u2014"}</div></div>
                        {order.specialNotes && <div style={{ background: "#FAFAFA", border: `1px solid ${t.border}`, borderRadius: "10px", padding: "14px" }}><div style={labelStyle}>Special Notes</div><div style={{ color: t.text, fontSize: "14px", lineHeight: 1.6 }}>{order.specialNotes}</div></div>}
                      </div>
                    </div>))}
                </div>}
            </>
          )}
        </div>
      </div>
    );
  }

  if (manageCrews) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "'DM Sans', sans-serif" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
        {toast && <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: t.accent, color: "#fff", padding: "12px 24px", borderRadius: "10px", fontSize: "14px", fontWeight: 600, zIndex: 1000 }}>{toast}</div>}
        <div style={{ padding: "16px 20px", borderBottom: `1.5px solid ${t.border}`, display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => { setManageCrews(false); setEditingCrewName(null); setNewMemberName(""); }} style={{ ...ghostBtn, padding: "8px" }}><BackIcon /></button>
          <div style={{ fontSize: "16px", fontWeight: 700, color: t.text }}>Manage Crew Rosters</div>
        </div>
        <div style={{ padding: "20px" }}>
          {crewNames.map((crew) => (
            <div key={crew} style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: t.text, marginBottom: "10px", borderBottom: `1.5px solid ${t.border}`, paddingBottom: "8px" }}>{crew}</div>
              {(crews[crew] || []).length === 0 && <div style={{ color: t.textMuted, fontSize: "13px", marginBottom: "8px" }}>No members yet</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                {(crews[crew] || []).map((name, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: t.card, padding: "10px 14px", borderRadius: "8px" }}>
                    <span style={{ fontSize: "14px", color: t.text }}>{name}</span>
                    <button onClick={() => removeMember(crew, idx)} style={{ ...ghostBtn, padding: "4px", color: t.danger }}><TrashIcon /></button>
                  </div>))}
              </div>
              {editingCrewName === crew ? (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Name" style={{ ...inputStyle, flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") addMember(crew); }} />
                  <button onClick={() => addMember(crew)} style={{ ...primaryBtn, padding: "10px 16px", fontSize: "14px" }}>Add</button>
                  <button onClick={() => { setEditingCrewName(null); setNewMemberName(""); }} style={{ ...ghostBtn }}>Cancel</button>
                </div>
              ) : <button onClick={() => { setEditingCrewName(crew); setNewMemberName(""); }} style={{ ...ghostBtn, color: t.accent, fontSize: "13px", padding: "6px 0", gap: "4px" }}><PlusIcon /> Add Member</button>}
            </div>))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
      {toast && <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: t.accent, color: "#fff", padding: "12px 24px", borderRadius: "10px", fontSize: "14px", fontWeight: 600, zIndex: 1000, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>{toast}</div>}

      {deleteConfirm !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#fff", border: `1.5px solid ${t.border}`, borderRadius: "16px", padding: "28px", maxWidth: "320px", width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "17px", fontWeight: 700, color: t.text, marginBottom: "8px" }}>Delete Work Order?</div>
            <div style={{ fontSize: "14px", color: t.textMuted, marginBottom: "24px" }}>This can't be undone.</div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ ...baseBtn, flex: 1, background: t.card, color: t.textMuted, padding: "12px" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ ...baseBtn, flex: 1, background: t.danger, color: "#fff", padding: "12px" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "16px 20px", borderBottom: `1.5px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => { setMode(null); setShowForm(false); setEditingOrder(null); }} style={{ ...ghostBtn, padding: "8px" }}><BackIcon /></button>
          <Logo size={36} />
          <div><div style={{ fontSize: "16px", fontWeight: 700, color: t.text }}>Manager</div><div style={{ fontSize: "12px", color: t.textMuted }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div></div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setManageCrews(true)} style={{ ...ghostBtn, padding: "8px" }} title="Manage Crews"><SettingsIcon /></button>
          {!showForm && <button onClick={() => { setFormData({ ...emptyOrder }); setEditingOrder(null); setShowForm(true); }} style={{ ...primaryBtn, padding: "10px 18px", fontSize: "14px" }}><PlusIcon /> New</button>}
        </div>
      </div>

      <div style={{ padding: "20px" }}>
        {showForm ? (
          <div style={{ animation: "fadeIn 0.2s ease" }}>
            <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", color: t.text, margin: "0 0 20px" }}>{editingOrder !== null ? "Edit Work Order" : "New Work Order"}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <label style={labelStyle}>Crew</label>
                <select value={formData.crewName} onChange={(e) => setFormData({ ...formData, crewName: e.target.value, members: [] })} style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}>
                  <option value="">Select a crew...</option>
                  {crewNames.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {formData.crewName && (crews[formData.crewName] || []).length > 0 && (
                <div>
                  <label style={labelStyle}>Assign Members</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(crews[formData.crewName] || []).map((name) => { const selected = formData.members.includes(name); return (
                      <button key={name} onClick={() => toggleMember(name)} style={{ ...baseBtn, padding: "8px 14px", borderRadius: "20px", fontSize: "13px", background: selected ? t.accent : t.card, color: selected ? "#fff" : t.text, border: `1.5px solid ${selected ? t.accent : t.border}`, gap: "4px" }}>
                        {selected && <CheckIcon />}{name}
                      </button>); })}
                  </div>
                </div>
              )}

              <div><label style={labelStyle}>Date</label><input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} style={inputStyle} /></div>

              <div>
                <label style={labelStyle}>Job Address</label>
                <AddressInput value={formData.jobAddress} onChange={(e) => setFormData({ ...formData, jobAddress: e.target.value })} style={inputStyle} />
                <div style={{ fontSize: "11px", color: t.textMuted, marginTop: "4px" }}>Start typing and select from suggestions</div>
              </div>

              <div><label style={labelStyle}>Job Description</label><textarea value={formData.jobDescription} onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })} placeholder="Describe the work..." rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }} /></div>
              <div><label style={labelStyle}>Materials Required</label><textarea value={formData.materials} onChange={(e) => setFormData({ ...formData, materials: e.target.value })} placeholder="List materials..." rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }} /></div>
              <div><label style={labelStyle}>Special Notes</label><textarea value={formData.specialNotes} onChange={(e) => setFormData({ ...formData, specialNotes: e.target.value })} placeholder="Any special instructions..." rows={2} style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }} /></div>

              <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                <button onClick={() => { setShowForm(false); setEditingOrder(null); }} style={{ ...baseBtn, flex: 1, background: t.card, border: `1.5px solid ${t.border}`, color: t.textMuted, padding: "14px" }}>Cancel</button>
                <button onClick={handleSave} style={{ ...primaryBtn, flex: 2 }}>{editingOrder !== null ? "Update" : "Create Order"}</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", color: t.text, margin: "0 0 4px" }}>Today's Orders</h2>
            <p style={{ color: t.textMuted, fontSize: "13px", margin: "0 0 16px" }}>{todayOrders.length} work order{todayOrders.length !== 1 ? "s" : ""}</p>
            {todayOrders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px" }}><div style={{ fontSize: "15px", color: t.textMuted }}>No work orders for today</div><div style={{ fontSize: "13px", color: t.textMuted, marginTop: "6px" }}>Tap "New" to create one</div></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {todayOrders.map((order) => { const realIndex = orders.indexOf(order); return (
                  <div key={realIndex} style={{ background: t.card, border: `1.5px solid ${t.border}`, borderRadius: "12px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <span style={{ fontSize: "12px", background: t.accent, color: "#fff", padding: "3px 10px", borderRadius: "20px", fontWeight: 700 }}>{order.crewName}</span>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button onClick={() => { setFormData({ ...order, members: order.members || [] }); setEditingOrder(realIndex); setShowForm(true); }} style={{ ...ghostBtn, padding: "6px" }}><EditIcon /></button>
                        <button onClick={() => setDeleteConfirm(realIndex)} style={{ ...ghostBtn, padding: "6px", color: t.danger }}><TrashIcon /></button>
                      </div>
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: t.text, marginBottom: "4px" }}>{order.jobAddress}</div>
                    {order.members && order.members.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "6px" }}>{order.members.map((m) => <span key={m} style={{ fontSize: "11px", background: t.tag, padding: "2px 8px", borderRadius: "10px", color: t.accentLight }}>{m}</span>)}</div>}
                    <div style={{ fontSize: "13px", color: t.textMuted, lineHeight: 1.5 }}>{order.jobDescription ? (order.jobDescription.length > 100 ? order.jobDescription.slice(0, 100) + "..." : order.jobDescription) : "No description"}</div>
                  </div>); })}
              </div>
            )}

            {orders.length > 0 && orders.length !== todayOrders.length && (
              <div style={{ marginTop: "28px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, color: t.textMuted, marginBottom: "10px" }}>Past Orders ({orders.filter((o) => o.date !== todayStr).length})</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {orders.filter((o) => o.date !== todayStr).map((order) => { const realIndex = orders.indexOf(order); return (
                    <div key={realIndex} style={{ background: t.card, border: `1.5px solid ${t.border}`, borderRadius: "10px", padding: "12px 14px", opacity: 0.7, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: "11px", color: t.textMuted }}>{order.date}</span>
                        <span style={{ fontSize: "11px", color: t.accent, marginLeft: "8px", fontWeight: 600 }}>{order.crewName}</span>
                        <div style={{ fontSize: "13px", color: t.text, marginTop: "2px" }}>{order.jobAddress}</div>
                      </div>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button onClick={() => { setFormData({ ...order, members: order.members || [] }); setEditingOrder(realIndex); setShowForm(true); }} style={{ ...ghostBtn, padding: "6px" }}><EditIcon /></button>
                        <button onClick={() => setDeleteConfirm(realIndex)} style={{ ...ghostBtn, padding: "6px", color: t.danger }}><TrashIcon /></button>
                      </div>
                    </div>); })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
