import React, { useState, useEffect, useCallback, useRef } from "react";
import { db, ref, set, onValue, storage, storageRef, uploadBytes, getDownloadURL } from "./firebase";

const GOOGLE_API_KEY = "AIzaSyDP9N998QacTADs3UaDYBohltD3rfflMmE";
const LOGO_SRC = "/logo.jpg";
const ALL_MEMBERS = ["Luis","Azael","Oswaldo","Andres","Vicente","Gabriel","Geovanny"];
const DEFAULT_CREWS = {"Crew 1":[...ALL_MEMBERS],"Crew 2":[...ALL_MEMBERS],"Crew 3":[...ALL_MEMBERS],"Crew 4":[...ALL_MEMBERS],"Crew 5":[...ALL_MEMBERS]};
const FIELD_OPS_MEMBERS = ["Joe","Bryan"];
const DEFAULT_PIN = "1234";

const emptyCrewOrder = {crewName:"",members:[],jobAddress:"",jobDescription:"",materials:"",specialNotes:"",customerName:"",customerPhone:"",date:new Date().toISOString().split("T")[0],attachments:[]};
const emptyFieldOrder = {staffMember:[],todaysTasks:"",jobRequests:"",date:new Date().toISOString().split("T")[0],attachments:[]};

function saveToFB(path,data){set(ref(db,path),data).catch(e=>console.error("FB save:",e));}
function useFB(path,fb){const[d,setD]=useState(fb);const[l,setL]=useState(false);useEffect(()=>{const u=onValue(ref(db,path),s=>{const v=s.val();setD(v!==null?v:fb);setL(true);},()=>setL(true));return()=>u();},[path]);return[d,l];}

function isExpired(order){const now=new Date();const od=new Date(order.date+"T06:00:00");const ex=new Date(od);ex.setDate(ex.getDate()+1);return now>=ex;}
function getActive(orders){return(orders||[]).filter(o=>!isExpired(o));}
function getArchived(orders){return(orders||[]).filter(o=>isExpired(o));}

// Theme
const t={bg:"#FFFFFF",card:"#F7F7F8",accent:"#1A1A1A",accentLight:"#444",text:"#1A1A1A",textMuted:"#71717A",border:"#E4E4E7",danger:"#DC2626",inputBg:"#FFFFFF",tag:"#F0F0F2",fieldOps:"#1E40AF"};
const baseBtn={border:"none",borderRadius:"10px",cursor:"pointer",fontFamily:"'DM Sans', sans-serif",fontWeight:600,transition:"all 0.15s ease",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"};
const primaryBtn={...baseBtn,background:t.accent,color:"#fff",padding:"14px 24px",fontSize:"15px"};
const ghostBtn={...baseBtn,background:"transparent",color:t.textMuted,padding:"10px 16px",fontSize:"14px"};
const inputStyle={width:"100%",padding:"14px 16px",background:t.inputBg,border:`1.5px solid ${t.border}`,borderRadius:"10px",color:t.text,fontSize:"15px",fontFamily:"'DM Sans', sans-serif",outline:"none",boxSizing:"border-box"};
const labelStyle={display:"block",fontSize:"11px",fontWeight:700,color:t.textMuted,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:"8px"};

// Icons
const PlusIcon=()=><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>;
const BackIcon=()=><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>;
const TrashIcon=()=><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>;
const EditIcon=()=><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const MapIcon=()=><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const CheckIcon=()=><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>;
const SettingsIcon=()=><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
const SearchIcon=()=><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>;
const PaperclipIcon=()=><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>;
const ArchiveIcon=()=><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>;
const PrintIcon=()=><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;
const LockIcon=()=><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;
const BellIcon=()=><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>;
const UserIcon=()=><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const PhoneIcon=()=><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>;

function getMapsUrl(a){const e=encodeURIComponent(a);return/iPad|iPhone|iPod/.test(navigator.userAgent)?`maps://maps.apple.com/?q=${e}`:`https://www.google.com/maps/search/?api=1&query=${e}`;}

// Bullet Textarea
function BulletTextarea({value,onChange,placeholder,style:s}){
  const handleKeyDown=(e)=>{if(e.key==="Enter"){e.preventDefault();const v=e.target.value;const pos=e.target.selectionStart;const nv=v.slice(0,pos)+"\n\u2022 "+v.slice(pos);onChange({target:{value:nv}});setTimeout(()=>{e.target.selectionStart=e.target.selectionEnd=pos+3;},0);}};
  const handleChange=(e)=>{let v=e.target.value;if(v&&!v.startsWith("\u2022")&&v.trim().length>0&&!value)v="\u2022 "+v;onChange({target:{value:v}});};
  return<textarea value={value} onChange={handleChange} onKeyDown={handleKeyDown} placeholder={placeholder} rows={3} style={{...s,resize:"vertical",minHeight:"80px"}}/>;
}

// Address Input
function AddressInput({value,onChange,style:s}){
  const[sug,setSug]=useState([]);const[show,setShow]=useState(false);const[tok,setTok]=useState(null);const[loaded,setLoaded]=useState(false);const debRef=useRef(null);const wRef=useRef(null);
  useEffect(()=>{if(window.google?.maps?.places){setLoaded(true);return;}const ex=document.querySelector(`script[src*="maps.googleapis.com"]`);if(ex){ex.addEventListener("load",()=>setLoaded(true));return;}const sc=document.createElement("script");sc.src=`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&loading=async`;sc.async=true;sc.defer=true;sc.onload=()=>setLoaded(true);document.head.appendChild(sc);},[]);
  useEffect(()=>{if(loaded&&window.google?.maps?.places)try{setTok(new window.google.maps.places.AutocompleteSessionToken());}catch(e){}},[loaded]);
  useEffect(()=>{const h=e=>{if(wRef.current&&!wRef.current.contains(e.target))setShow(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const fetch=useCallback(input=>{if(!loaded||!input||input.length<3){setSug([]);return;}try{new window.google.maps.places.AutocompleteService().getPlacePredictions({input,types:["address"],componentRestrictions:{country:"us"},sessionToken:tok},(p,st)=>{if(st===window.google.maps.places.PlacesServiceStatus.OK&&p){setSug(p.map(x=>({description:x.description})));setShow(true);}else setSug([]);});}catch(e){}},[loaded,tok]);
  const hc=e=>{onChange(e);if(debRef.current)clearTimeout(debRef.current);debRef.current=setTimeout(()=>fetch(e.target.value),300);};
  const hs=d=>{onChange({target:{value:d}});setShow(false);setSug([]);try{setTok(new window.google.maps.places.AutocompleteSessionToken());}catch(e){}};
  return(<div ref={wRef} style={{position:"relative"}}><input type="text" value={value} onChange={hc} onFocus={()=>{if(sug.length>0)setShow(true);}} placeholder="Start typing an address..." style={s}/>
    {show&&sug.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1.5px solid #E4E4E7",borderRadius:"0 0 10px 10px",boxShadow:"0 4px 16px rgba(0,0,0,0.1)",zIndex:100,maxHeight:"200px",overflowY:"auto"}}>
      {sug.map((x,i)=><div key={i} onClick={()=>hs(x.description)} style={{padding:"12px 16px",cursor:"pointer",fontSize:"14px",borderBottom:i<sug.length-1?"1px solid #F0F0F2":"none",display:"flex",alignItems:"center",gap:"8px"}} onMouseEnter={e=>e.currentTarget.style.background="#F7F7F8"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}><SearchIcon/>{x.description}</div>)}</div>}</div>);
}

const Logo=({size=60})=><img src={LOGO_SRC} alt="Icon Remodeling Group" style={{width:size,height:"auto",objectFit:"contain"}}/>;
const renderBullet=text=>{if(!text)return"\u2014";return text.split("\n").map((l,i)=><div key={i} style={{marginBottom:"2px"}}>{l}</div>);};

// PIN Dialog
function PinDialog({onSuccess,onCancel,title}){
  const[pin,setPin]=useState("");const[err,setErr]=useState(false);const[storedPin,setStoredPin]=useState(DEFAULT_PIN);
  useEffect(()=>{const u=onValue(ref(db,"settings/managerPin"),s=>{const v=s.val();if(v)setStoredPin(v);});return()=>u();},[]);
  const check=()=>{if(pin===storedPin){onSuccess();}else{setErr(true);setPin("");setTimeout(()=>setErr(false),2000);}};
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
    <div style={{background:"#fff",borderRadius:"16px",padding:"32px",maxWidth:"320px",width:"100%",textAlign:"center"}}>
      <LockIcon/><h3 style={{margin:"12px 0 4px",fontSize:"18px",color:t.text}}>{title||"Enter Manager PIN"}</h3>
      <p style={{fontSize:"13px",color:t.textMuted,marginBottom:"20px"}}>This area is protected</p>
      <input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")check();}}
        placeholder="Enter PIN" style={{...inputStyle,textAlign:"center",fontSize:"24px",letterSpacing:"8px",marginBottom:"12px"}}/>
      {err&&<div style={{color:t.danger,fontSize:"13px",marginBottom:"8px"}}>Incorrect PIN</div>}
      <div style={{display:"flex",gap:"10px"}}>
        <button onClick={onCancel} style={{...baseBtn,flex:1,background:t.card,color:t.textMuted,padding:"12px"}}>Cancel</button>
        <button onClick={check} style={{...primaryBtn,flex:1,padding:"12px"}}>Enter</button>
      </div>
    </div>
  </div>);
}

export default function App(){
  const[mode,setMode]=useState(null);
  const[orders,ordersL]=useFB("orders",[]);
  const[fieldOrders,fieldL]=useFB("fieldOrders",[]);
  const[crews,crewsL]=useFB("crews",DEFAULT_CREWS);
  const[managerPin]=useFB("settings/managerPin",DEFAULT_PIN);
  const[lastSeen,setLastSeen]=useState(()=>{try{return localStorage.getItem("wo-lastSeen")||"";}catch{return"";}});
  const[selectedCrew,setSelectedCrew]=useState(null);
  const[editingOrder,setEditingOrder]=useState(null);
  const[formData,setFormData]=useState({...emptyCrewOrder});
  const[fieldFormData,setFieldFormData]=useState({...emptyFieldOrder});
  const[showForm,setShowForm]=useState(false);
  const[deleteConfirm,setDeleteConfirm]=useState(null);
  const[toast,setToast]=useState(null);
  const[manageCrews,setManageCrews]=useState(false);
  const[newMemberName,setNewMemberName]=useState("");
  const[editingCrewName,setEditingCrewName]=useState(null);
  const[showArchive,setShowArchive]=useState(false);
  const[uploading,setUploading]=useState(false);
  const[pinDialog,setPinDialog]=useState(null);
  const[managerAuth,setManagerAuth]=useState(false);
  const[showPinSettings,setShowPinSettings]=useState(false);
  const[newPin,setNewPin]=useState("");
  const[editingFieldOrder,setEditingFieldOrder]=useState(null);
  const[showFieldForm,setShowFieldForm]=useState(false);
  const[selectedCrewOrder,setSelectedCrewOrder]=useState(null);
  const fileRef=useRef(null);
  const fieldFileRef=useRef(null);

  const loading=!ordersL||!crewsL||!fieldL;
  const showToast=useCallback(msg=>{setToast(msg);setTimeout(()=>setToast(null),2200);},[]);

  // Track last seen for notifications
  useEffect(()=>{const ts=new Date().toISOString();localStorage.setItem("wo-lastSeen",ts);},[mode]);

  // Check for updates (simple badge)
  const allOrders=[...orders,...fieldOrders];
  const hasUpdates=allOrders.some(o=>o.lastModified&&o.lastModified>lastSeen);

  // File upload handler
  const handleUpload=async(e,fd,setFd)=>{
    const files=Array.from(e.target.files);if(!files.length)return;setUploading(true);
    const atts=[...(fd.attachments||[])];
    for(const f of files){try{const fn=`${Date.now()}_${f.name}`;const fr=storageRef(storage,`attachments/${fn}`);await uploadBytes(fr,f);const url=await getDownloadURL(fr);atts.push({name:f.name,url,uploadedAt:new Date().toISOString()});}catch(err){showToast("Upload failed");}}
    setFd({...fd,attachments:atts});setUploading(false);showToast(`${files.length} file(s) uploaded`);e.target.value="";
  };

  // Crew order handlers
  const saveCrew=()=>{
    if(!formData.crewName||!formData.jobAddress){showToast("Crew and address required");return;}
    const now=new Date().toISOString();const d={...formData,lastModified:now};let u;
    if(editingOrder!==null){u=orders.map((o,i)=>i===editingOrder?d:o);}else{u=[...orders,d];}
    saveToFB("orders",u);setShowForm(false);setEditingOrder(null);setFormData({...emptyCrewOrder});showToast(editingOrder!==null?"Updated":"Work order created");
  };
  const deleteCrew=i=>{saveToFB("orders",orders.filter((_,x)=>x!==i));setDeleteConfirm(null);showToast("Deleted");};
  const addMember=(crew)=>{if(!newMemberName.trim())return;saveToFB("crews",{...crews,[crew]:[...(crews[crew]||[]),newMemberName.trim()]});setNewMemberName("");showToast("Added");};
  const removeMember=(crew,i)=>{saveToFB("crews",{...crews,[crew]:crews[crew].filter((_,x)=>x!==i)});showToast("Removed");};
  const toggleMember=n=>{setFormData(p=>({...p,members:p.members.includes(n)?p.members.filter(x=>x!==n):[...p.members,n]}));};

  // Field Ops handlers
  const saveField=()=>{
    const now=new Date().toISOString();const d={...fieldFormData,lastModified:now};let u;
    if(editingFieldOrder!==null){u=fieldOrders.map((o,i)=>i===editingFieldOrder?d:o);}else{u=[...fieldOrders,d];}
    saveToFB("fieldOrders",u);setShowFieldForm(false);setEditingFieldOrder(null);setFieldFormData({...emptyFieldOrder});showToast(editingFieldOrder!==null?"Updated":"Field order created");
  };
  const deleteField=i=>{saveToFB("fieldOrders",fieldOrders.filter((_,x)=>x!==i));setDeleteConfirm(null);showToast("Deleted");};
  const toggleFieldMember=n=>{setFieldFormData(p=>({...p,staffMember:p.staffMember.includes(n)?p.staffMember.filter(x=>x!==n):[...p.staffMember,n]}));};

  const todayStr=new Date().toISOString().split("T")[0];
  const activeCrew=getActive(orders);const activeField=getActive(fieldOrders);
  const allArchived=[...getArchived(orders).map(o=>({...o,type:"crew"})),...getArchived(fieldOrders).map(o=>({...o,type:"field"}))].sort((a,b)=>b.date.localeCompare(a.date));
  const todayCrew=activeCrew.filter(o=>o.date===todayStr);
  const crewOrders=selectedCrew?activeCrew.filter(o=>o.crewName===selectedCrew):[];
  const crewNames=Object.keys(crews);

  const handlePrint=(order)=>{
    const w=window.open("","_blank","width=800,height=600");
    const members=(order.members||order.staffMember||[]).join(", ");
    w.document.write(`<html><head><title>Work Order</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#1a1a1a;}h1{font-size:22px;margin-bottom:4px;}h2{font-size:16px;color:#666;margin-bottom:20px;}.section{margin-bottom:16px;}.label{font-size:11px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;}.value{font-size:14px;line-height:1.6;white-space:pre-wrap;}.att{color:#1a1a1a;font-size:12px;}</style></head><body>`);
    w.document.write(`<img src="${window.location.origin}/logo.jpg" style="width:80px;margin-bottom:12px;"/>`);
    w.document.write(`<h1>${order.crewName||"Field Operations"}</h1>`);
    if(members)w.document.write(`<h2>${members}</h2>`);
    w.document.write(`<div class="section"><div class="label">Date</div><div class="value">${order.date}</div></div>`);
    if(order.customerName)w.document.write(`<div class="section"><div class="label">Customer</div><div class="value">${order.customerName}${order.customerPhone?" \u2022 "+order.customerPhone:""}</div></div>`);
    if(order.jobAddress)w.document.write(`<div class="section"><div class="label">Job Address</div><div class="value">${order.jobAddress}</div></div>`);
    if(order.jobDescription)w.document.write(`<div class="section"><div class="label">Job Description</div><div class="value">${order.jobDescription}</div></div>`);
    if(order.todaysTasks)w.document.write(`<div class="section"><div class="label">Today's Tasks</div><div class="value">${order.todaysTasks}</div></div>`);
    if(order.materials)w.document.write(`<div class="section"><div class="label">Materials Required</div><div class="value">${order.materials}</div></div>`);
    if(order.jobRequests)w.document.write(`<div class="section"><div class="label">Job Specific Requests</div><div class="value">${order.jobRequests}</div></div>`);
    if(order.specialNotes)w.document.write(`<div class="section"><div class="label">Special Notes</div><div class="value">${order.specialNotes}</div></div>`);
    if(order.attachments?.length)w.document.write(`<div class="section"><div class="label">Attachments</div>${order.attachments.map(a=>`<div class="att">\u{1F4CE} ${a.name}</div>`).join("")}</div>`);
    w.document.write(`</body></html>`);w.document.close();setTimeout(()=>w.print(),500);
  };

  // PIN settings
  const saveNewPin=()=>{if(newPin.length>=4){saveToFB("settings/managerPin",newPin);setNewPin("");setShowPinSettings(false);showToast("PIN updated");}else showToast("PIN must be at least 4 digits");};

  if(loading)return(<div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans', sans-serif",display:"flex",alignItems:"center",justifyContent:"center"}}><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/><div style={{textAlign:"center",color:t.textMuted}}><Logo size={60}/><p style={{marginTop:"16px"}}>Loading...</p></div></div>);

  // Toast
  const Toast=()=>toast?<div style={{position:"fixed",top:"20px",left:"50%",transform:"translateX(-50%)",background:t.accent,color:"#fff",padding:"12px 24px",borderRadius:"10px",fontSize:"14px",fontWeight:600,zIndex:1001,boxShadow:"0 4px 20px rgba(0,0,0,0.15)"}}>{toast}</div>:null;

  // ── HOME ──
  if(mode===null)return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans', sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet"/>
      <div style={{textAlign:"center",marginBottom:"40px"}}><Logo size={80}/><h1 style={{fontFamily:"'Playfair Display', serif",fontSize:"28px",color:t.text,margin:"16px 0 0"}}>Work Orders</h1><p style={{color:t.textMuted,fontSize:"14px",marginTop:"6px"}}>Create and view daily crew assignments</p></div>
      <div style={{display:"flex",flexDirection:"column",gap:"12px",width:"100%",maxWidth:"320px"}}>
        <button onClick={()=>setPinDialog("manager")} style={{...baseBtn,background:t.card,border:`1.5px solid ${t.border}`,padding:"22px 20px",borderRadius:"14px",flexDirection:"column",gap:"6px",color:t.text,position:"relative"}}>
          <span style={{display:"flex",alignItems:"center",gap:"6px"}}><LockIcon/><span style={{fontSize:"17px",fontWeight:700}}>Manager</span></span><span style={{fontSize:"13px",color:t.textMuted,fontWeight:400}}>Create & manage work orders</span>
        </button>
        <button onClick={()=>setMode("crew")} style={{...baseBtn,background:t.card,border:`1.5px solid ${t.border}`,padding:"22px 20px",borderRadius:"14px",flexDirection:"column",gap:"6px",color:t.text,position:"relative"}}>
          <span style={{fontSize:"17px",fontWeight:700}}>Crew</span><span style={{fontSize:"13px",color:t.textMuted,fontWeight:400}}>View today's assignments</span>
          {hasUpdates&&<span style={{position:"absolute",top:"12px",right:"12px",width:"10px",height:"10px",background:t.danger,borderRadius:"50%"}}/>}
        </button>
        <button onClick={()=>setMode("fieldops")} style={{...baseBtn,background:t.card,border:`1.5px solid ${t.border}`,padding:"22px 20px",borderRadius:"14px",flexDirection:"column",gap:"6px",color:t.text}}>
          <span style={{fontSize:"17px",fontWeight:700}}>Field Operations</span><span style={{fontSize:"13px",color:t.textMuted,fontWeight:400}}>Joe & Bryan work orders</span>
        </button>
      </div>
      {pinDialog==="manager"&&<PinDialog title="Enter Manager PIN" onSuccess={()=>{setPinDialog(null);setManagerAuth(true);setMode("manager");}} onCancel={()=>setPinDialog(null)}/>}
    </div>
  );

  // ── CREW VIEW ──
  if(mode==="crew"){
    const allActiveCrewOrders=activeCrew;
    const selectedOrder=selectedCrewOrder!==null?allActiveCrewOrders[selectedCrewOrder]:null;
    
    return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans', sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet"/><Toast/>
      <div style={{padding:"16px 20px",borderBottom:`1.5px solid ${t.border}`,display:"flex",alignItems:"center",gap:"12px"}} className="no-print">
        <button onClick={()=>{if(selectedCrewOrder!==null){setSelectedCrewOrder(null);}else{setMode(null);}}} style={{...ghostBtn,padding:"8px"}}><BackIcon/></button><Logo size={36}/>
        <div><div style={{fontSize:"16px",fontWeight:700,color:t.text}}>{selectedOrder?"Work Order":"Crew View"}</div><div style={{fontSize:"12px",color:t.textMuted}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div></div>
      </div>
      <div style={{padding:"20px"}}>
        {selectedOrder?(
          <div style={{background:t.card,border:`1.5px solid ${t.border}`,borderRadius:"14px",padding:"20px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"12px"}}>
              <div style={{borderLeft:`3px solid ${t.accent}`,paddingLeft:"14px"}}>
                {selectedOrder.members?.length>0&&<div style={{fontSize:"15px",fontWeight:700,color:t.text,marginBottom:"4px"}}>{selectedOrder.members.join(", ")}</div>}
                <a href={getMapsUrl(selectedOrder.jobAddress)} target="_blank" rel="noopener noreferrer" style={{fontSize:"16px",fontWeight:600,color:t.text,textDecoration:"none",display:"flex",alignItems:"center",gap:"8px"}}>{selectedOrder.jobAddress} <MapIcon/></a>
              </div>
              <button onClick={()=>handlePrint(selectedOrder)} style={{...ghostBtn,padding:"8px"}} className="no-print"><PrintIcon/></button>
            </div>
            {selectedOrder.customerName&&<div style={{fontSize:"14px",color:t.text,display:"flex",alignItems:"center",gap:"6px",marginBottom:"4px"}}><UserIcon/> {selectedOrder.customerName}</div>}
            {selectedOrder.customerPhone&&<div style={{fontSize:"14px",color:t.textMuted,display:"flex",alignItems:"center",gap:"6px",marginBottom:"12px"}}><PhoneIcon/> {selectedOrder.customerPhone}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
              <div><div style={labelStyle}>Job Description</div><div style={{color:t.text,fontSize:"14px",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{renderBullet(selectedOrder.jobDescription)}</div></div>
              <div><div style={labelStyle}>Materials Required</div><div style={{color:t.text,fontSize:"14px",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{renderBullet(selectedOrder.materials)}</div></div>
              {selectedOrder.specialNotes&&<div style={{background:"#FAFAFA",border:`1px solid ${t.border}`,borderRadius:"10px",padding:"14px"}}><div style={labelStyle}>Special Notes</div><div style={{color:t.text,fontSize:"14px",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{renderBullet(selectedOrder.specialNotes)}</div></div>}
              {selectedOrder.attachments?.length>0&&<div><div style={labelStyle}>Attachments</div><div style={{display:"flex",flexDirection:"column",gap:"6px"}}>{selectedOrder.attachments.map((a,i)=><a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{fontSize:"14px",color:t.accent,textDecoration:"none",display:"flex",alignItems:"center",gap:"6px",padding:"8px 12px",background:t.tag,borderRadius:"8px"}}><PaperclipIcon/> {a.name}</a>)}</div></div>}
            </div>
          </div>
        ):(
          <>
            <h2 style={{fontFamily:"'Playfair Display', serif",fontSize:"22px",color:t.text,margin:"0 0 16px"}}>Today's Work Orders</h2>
            {allActiveCrewOrders.length===0?<div style={{textAlign:"center",padding:"48px 20px",color:t.textMuted}}>No active work orders</div>
            :<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              {allActiveCrewOrders.map((order,idx)=>(
                <button key={idx} onClick={()=>setSelectedCrewOrder(idx)} style={{...baseBtn,background:t.card,border:`1.5px solid ${t.border}`,padding:"18px 20px",borderRadius:"12px",flexDirection:"column",alignItems:"flex-start",gap:"6px",color:t.text,fontSize:"16px",width:"100%",textAlign:"left"}}>
                  <div style={{fontSize:"16px",fontWeight:700,color:t.text}}>{order.members?.length>0?order.members.join(", "):order.crewName}</div>
                  <div style={{fontSize:"13px",color:t.textMuted}}>{order.jobAddress}</div>
                  {order.attachments?.length>0&&<div style={{fontSize:"11px",color:t.textMuted,display:"flex",alignItems:"center",gap:"4px"}}><PaperclipIcon/> {order.attachments.length} attachment{order.attachments.length>1?"s":""}</div>}
                </button>))}
            </div>}
          </>
        )}
      </div>
    </div>);
  }

  // ── FIELD OPS ──
  if(mode==="fieldops")return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans', sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet"/><Toast/>
      <div style={{padding:"16px 20px",borderBottom:`1.5px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}} className="no-print">
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <button onClick={()=>{setMode(null);setShowFieldForm(false);setEditingFieldOrder(null);}} style={{...ghostBtn,padding:"8px"}}><BackIcon/></button><Logo size={36}/>
          <div><div style={{fontSize:"16px",fontWeight:700,color:t.text}}>Field Operations</div><div style={{fontSize:"12px",color:t.textMuted}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div></div>
        </div>
        {!showFieldForm&&<button onClick={()=>{setFieldFormData({...emptyFieldOrder});setEditingFieldOrder(null);setShowFieldForm(true);}} style={{...primaryBtn,padding:"10px 18px",fontSize:"14px"}}><PlusIcon/> New</button>}
      </div>
      <div style={{padding:"20px"}}>
        {showFieldForm?(
          <div style={{animation:"fadeIn 0.2s ease"}}><style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}`}</style>
            <h2 style={{fontFamily:"'Playfair Display', serif",fontSize:"22px",color:t.text,margin:"0 0 20px"}}>{editingFieldOrder!==null?"Edit Work Order":"New Field Work Order"}</h2>
            <div style={{display:"flex",flexDirection:"column",gap:"18px"}}>
              <div><label style={labelStyle}>Staff Member</label><div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>{FIELD_OPS_MEMBERS.map(n=>{const sel=(fieldFormData.staffMember||[]).includes(n);return<button key={n} onClick={()=>toggleFieldMember(n)} style={{...baseBtn,padding:"8px 14px",borderRadius:"20px",fontSize:"13px",background:sel?t.accent:t.card,color:sel?"#fff":t.text,border:`1.5px solid ${sel?t.accent:t.border}`,gap:"4px"}}>{sel&&<CheckIcon/>}{n}</button>;})}</div></div>
              <div><label style={labelStyle}>Date</label><input type="date" value={fieldFormData.date} onChange={e=>setFieldFormData({...fieldFormData,date:e.target.value})} style={inputStyle}/></div>
              <div><label style={labelStyle}>Today's Tasks</label><BulletTextarea value={fieldFormData.todaysTasks||""} onChange={e=>setFieldFormData({...fieldFormData,todaysTasks:e.target.value})} placeholder="Enter tasks... (press Enter for bullets)" style={inputStyle}/></div>
              <div><label style={labelStyle}>Job Specific Requests</label><BulletTextarea value={fieldFormData.jobRequests||""} onChange={e=>setFieldFormData({...fieldFormData,jobRequests:e.target.value})} placeholder="Enter requests... (press Enter for bullets)" style={inputStyle}/></div>
              <div><label style={labelStyle}>Attachments</label><input ref={fieldFileRef} type="file" multiple onChange={e=>handleUpload(e,fieldFormData,setFieldFormData)} style={{display:"none"}}/>
                <button onClick={()=>fieldFileRef.current?.click()} disabled={uploading} style={{...baseBtn,background:t.card,border:`1.5px solid ${t.border}`,color:t.text,padding:"12px 16px",fontSize:"14px",width:"100%",gap:"6px"}}><PaperclipIcon/> {uploading?"Uploading...":"Add Attachments"}</button>
                {fieldFormData.attachments?.length>0&&<div style={{marginTop:"10px",display:"flex",flexDirection:"column",gap:"6px"}}>{fieldFormData.attachments.map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:t.card,padding:"8px 12px",borderRadius:"8px"}}><span style={{fontSize:"13px",display:"flex",alignItems:"center",gap:"4px"}}><PaperclipIcon/>{a.name}</span><button onClick={()=>setFieldFormData({...fieldFormData,attachments:fieldFormData.attachments.filter((_,x)=>x!==i)})} style={{...ghostBtn,padding:"4px",color:t.danger}}><TrashIcon/></button></div>)}</div>}
              </div>
              <div style={{display:"flex",gap:"10px",marginTop:"4px"}}>
                <button onClick={()=>{setShowFieldForm(false);setEditingFieldOrder(null);}} style={{...baseBtn,flex:1,background:t.card,border:`1.5px solid ${t.border}`,color:t.textMuted,padding:"14px"}}>Cancel</button>
                <button onClick={saveField} style={{...primaryBtn,flex:2}}>{editingFieldOrder!==null?"Update":"Create Order"}</button>
              </div>
            </div>
          </div>
        ):(
          <>
            <h2 style={{fontFamily:"'Playfair Display', serif",fontSize:"22px",color:t.text,margin:"0 0 16px"}}>Active Orders</h2>
            {activeField.length===0?<div style={{textAlign:"center",padding:"48px",color:t.textMuted}}>No active field orders. Tap "New" to create one.</div>
            :<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              {activeField.map((order,idx)=>{const ri=fieldOrders.indexOf(order);return(
                <div key={ri} style={{background:t.card,border:`1.5px solid ${t.border}`,borderRadius:"12px",padding:"16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                    <div style={{fontSize:"15px",fontWeight:700,color:t.text}}>{(order.staffMember||[]).join(", ")||"Unassigned"}</div>
                    <div style={{display:"flex",gap:"4px"}} className="no-print">
                      <button onClick={()=>handlePrint(order)} style={{...ghostBtn,padding:"6px"}}><PrintIcon/></button>
                      <button onClick={()=>setPinDialog({type:"editField",index:ri})} style={{...ghostBtn,padding:"6px"}}><EditIcon/></button>
                      <button onClick={()=>setPinDialog({type:"deleteField",index:ri})} style={{...ghostBtn,padding:"6px",color:t.danger}}><TrashIcon/></button>
                    </div>
                  </div>
                  <div style={{fontSize:"12px",color:t.textMuted,marginBottom:"8px"}}>{order.date}</div>
                  {order.todaysTasks&&<div style={{fontSize:"13px",color:t.text,lineHeight:1.5,whiteSpace:"pre-wrap",marginBottom:"6px"}}>{renderBullet(order.todaysTasks)}</div>}
                  {order.attachments?.length>0&&<div style={{display:"flex",gap:"4px",flexWrap:"wrap",marginTop:"6px"}}>{order.attachments.map((a,i)=><a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{fontSize:"11px",background:t.tag,padding:"3px 8px",borderRadius:"6px",color:t.accent,textDecoration:"none",display:"flex",alignItems:"center",gap:"3px"}}><PaperclipIcon/>{a.name}</a>)}</div>}
                </div>);})}
            </div>}
          </>
        )}
      </div>
      {pinDialog?.type==="editField"&&<PinDialog title="Manager PIN to Edit" onSuccess={()=>{const o=fieldOrders[pinDialog.index];setFieldFormData({...emptyFieldOrder,...o,staffMember:o.staffMember||[],attachments:o.attachments||[]});setEditingFieldOrder(pinDialog.index);setShowFieldForm(true);setPinDialog(null);}} onCancel={()=>setPinDialog(null)}/>}
      {pinDialog?.type==="deleteField"&&<PinDialog title="Manager PIN to Delete" onSuccess={()=>{deleteField(pinDialog.index);setPinDialog(null);}} onCancel={()=>setPinDialog(null)}/>}
    </div>
  );

  // ── MANAGE CREWS ──
  if(manageCrews)return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans', sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet"/><Toast/>
      <div style={{padding:"16px 20px",borderBottom:`1.5px solid ${t.border}`,display:"flex",alignItems:"center",gap:"12px"}}>
        <button onClick={()=>{setManageCrews(false);setEditingCrewName(null);setNewMemberName("");}} style={{...ghostBtn,padding:"8px"}}><BackIcon/></button>
        <div style={{fontSize:"16px",fontWeight:700,color:t.text}}>Manage Crew Rosters</div>
      </div>
      <div style={{padding:"20px"}}>
        {crewNames.map(crew=>(
          <div key={crew} style={{marginBottom:"24px"}}>
            <div style={{fontSize:"16px",fontWeight:700,color:t.text,marginBottom:"10px",borderBottom:`1.5px solid ${t.border}`,paddingBottom:"8px"}}>{crew}</div>
            {(crews[crew]||[]).length===0&&<div style={{color:t.textMuted,fontSize:"13px",marginBottom:"8px"}}>No members yet</div>}
            <div style={{display:"flex",flexDirection:"column",gap:"6px",marginBottom:"10px"}}>{(crews[crew]||[]).map((n,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:t.card,padding:"10px 14px",borderRadius:"8px"}}><span style={{fontSize:"14px",color:t.text}}>{n}</span><button onClick={()=>removeMember(crew,i)} style={{...ghostBtn,padding:"4px",color:t.danger}}><TrashIcon/></button></div>)}</div>
            {editingCrewName===crew?(<div style={{display:"flex",gap:"8px"}}><input value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} placeholder="Name" style={{...inputStyle,flex:1}} onKeyDown={e=>{if(e.key==="Enter")addMember(crew);}}/><button onClick={()=>addMember(crew)} style={{...primaryBtn,padding:"10px 16px",fontSize:"14px"}}>Add</button><button onClick={()=>{setEditingCrewName(null);setNewMemberName("");}} style={{...ghostBtn}}>Cancel</button></div>)
            :<button onClick={()=>{setEditingCrewName(crew);setNewMemberName("");}} style={{...ghostBtn,color:t.accent,fontSize:"13px",padding:"6px 0",gap:"4px"}}><PlusIcon/> Add Member</button>}
          </div>))}
      </div>
    </div>
  );

  // ── ARCHIVE ──
  if(showArchive)return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans', sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet"/>
      <div style={{padding:"16px 20px",borderBottom:`1.5px solid ${t.border}`,display:"flex",alignItems:"center",gap:"12px"}}>
        <button onClick={()=>setShowArchive(false)} style={{...ghostBtn,padding:"8px"}}><BackIcon/></button><ArchiveIcon/>
        <div style={{fontSize:"16px",fontWeight:700,color:t.text}}>All Archived Orders</div>
      </div>
      <div style={{padding:"20px"}}>
        {allArchived.length===0?<div style={{textAlign:"center",padding:"48px",color:t.textMuted}}>No archived orders yet.</div>
        :<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          {allArchived.map((order,idx)=>(
            <div key={idx} style={{background:t.card,border:`1.5px solid ${t.border}`,borderRadius:"12px",padding:"16px",opacity:0.7}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                  <span style={{fontSize:"12px",background:order.type==="field"?t.fieldOps:t.accent,color:"#fff",padding:"3px 10px",borderRadius:"20px",fontWeight:700}}>{order.type==="field"?"Field Ops":order.crewName}</span>
                  <span style={{fontSize:"11px",color:t.textMuted}}>{order.date}</span>
                </div>
                <button onClick={()=>handlePrint(order)} style={{...ghostBtn,padding:"6px"}}><PrintIcon/></button>
              </div>
              <div style={{fontSize:"14px",fontWeight:600,color:t.text}}>{(order.members||order.staffMember||[]).join(", ")}</div>
              {order.jobAddress&&<div style={{fontSize:"13px",color:t.textMuted,marginTop:"2px"}}>{order.jobAddress}</div>}
              {order.attachments?.length>0&&<div style={{display:"flex",gap:"4px",flexWrap:"wrap",marginTop:"8px"}}>{order.attachments.map((a,i)=><a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{fontSize:"11px",background:t.tag,padding:"3px 8px",borderRadius:"6px",color:t.accent,textDecoration:"none",display:"flex",alignItems:"center",gap:"3px"}}><PaperclipIcon/>{a.name}</a>)}</div>}
            </div>))}
        </div>}
      </div>
    </div>
  );

  // ── PIN SETTINGS ──
  if(showPinSettings)return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans', sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/><Toast/>
      <div style={{padding:"16px 20px",borderBottom:`1.5px solid ${t.border}`,display:"flex",alignItems:"center",gap:"12px"}}>
        <button onClick={()=>setShowPinSettings(false)} style={{...ghostBtn,padding:"8px"}}><BackIcon/></button>
        <div style={{fontSize:"16px",fontWeight:700,color:t.text}}>Change Manager PIN</div>
      </div>
      <div style={{padding:"20px",maxWidth:"400px"}}>
        <p style={{color:t.textMuted,fontSize:"14px",marginBottom:"20px"}}>Current PIN: {managerPin}</p>
        <label style={labelStyle}>New PIN (min 4 digits)</label>
        <input type="password" inputMode="numeric" value={newPin} onChange={e=>setNewPin(e.target.value)} placeholder="Enter new PIN" style={{...inputStyle,marginBottom:"16px"}}/>
        <button onClick={saveNewPin} style={{...primaryBtn,width:"100%"}}>Update PIN</button>
      </div>
    </div>
  );

  // ── MANAGER ──
  return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans', sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet"/><Toast/>
      {deleteConfirm!==null&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}><div style={{background:"#fff",border:`1.5px solid ${t.border}`,borderRadius:"16px",padding:"28px",maxWidth:"320px",width:"100%",textAlign:"center"}}><div style={{fontSize:"17px",fontWeight:700,color:t.text,marginBottom:"8px"}}>Delete Work Order?</div><div style={{fontSize:"14px",color:t.textMuted,marginBottom:"24px"}}>This can't be undone.</div><div style={{display:"flex",gap:"10px"}}><button onClick={()=>setDeleteConfirm(null)} style={{...baseBtn,flex:1,background:t.card,color:t.textMuted,padding:"12px"}}>Cancel</button><button onClick={()=>deleteCrew(deleteConfirm)} style={{...baseBtn,flex:1,background:t.danger,color:"#fff",padding:"12px"}}>Delete</button></div></div></div>}
      <div style={{padding:"16px 20px",borderBottom:`1.5px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}} className="no-print">
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <button onClick={()=>{setMode(null);setShowForm(false);setEditingOrder(null);setManagerAuth(false);}} style={{...ghostBtn,padding:"8px"}}><BackIcon/></button><Logo size={36}/>
          <div><div style={{fontSize:"16px",fontWeight:700,color:t.text}}>Manager</div><div style={{fontSize:"12px",color:t.textMuted}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div></div>
        </div>
        <div style={{display:"flex",gap:"6px"}}>
          <button onClick={()=>setShowArchive(true)} style={{...ghostBtn,padding:"8px"}} title="Archive"><ArchiveIcon/></button>
          <button onClick={()=>setShowPinSettings(true)} style={{...ghostBtn,padding:"8px"}} title="PIN Settings"><LockIcon/></button>
          <button onClick={()=>setManageCrews(true)} style={{...ghostBtn,padding:"8px"}} title="Manage Crews"><SettingsIcon/></button>
          {!showForm&&<button onClick={()=>{setFormData({...emptyCrewOrder});setEditingOrder(null);setShowForm(true);}} style={{...primaryBtn,padding:"10px 18px",fontSize:"14px"}}><PlusIcon/> New</button>}
        </div>
      </div>
      <div style={{padding:"20px"}}>
        {showForm?(
          <div style={{animation:"fadeIn 0.2s ease"}}><style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}`}</style>
            <h2 style={{fontFamily:"'Playfair Display', serif",fontSize:"22px",color:t.text,margin:"0 0 20px"}}>{editingOrder!==null?"Edit Work Order":"New Work Order"}</h2>
            <div style={{display:"flex",flexDirection:"column",gap:"18px"}}>
              <div><label style={labelStyle}>Crew</label><select value={formData.crewName} onChange={e=>setFormData({...formData,crewName:e.target.value,members:[]})} style={{...inputStyle,appearance:"none",cursor:"pointer"}}><option value="">Select a crew...</option>{crewNames.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
              {formData.crewName&&(crews[formData.crewName]||[]).length>0&&<div><label style={labelStyle}>Assign Members</label><div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>{(crews[formData.crewName]||[]).map(n=>{const sel=formData.members.includes(n);return<button key={n} onClick={()=>toggleMember(n)} style={{...baseBtn,padding:"8px 14px",borderRadius:"20px",fontSize:"13px",background:sel?t.accent:t.card,color:sel?"#fff":t.text,border:`1.5px solid ${sel?t.accent:t.border}`,gap:"4px"}}>{sel&&<CheckIcon/>}{n}</button>;})}</div></div>}
              <div><label style={labelStyle}>Date</label><input type="date" value={formData.date} onChange={e=>setFormData({...formData,date:e.target.value})} style={inputStyle}/></div>
              <div style={{display:"flex",gap:"12px"}}><div style={{flex:1}}><label style={labelStyle}>Customer Name</label><input type="text" value={formData.customerName||""} onChange={e=>setFormData({...formData,customerName:e.target.value})} placeholder="Customer name" style={inputStyle}/></div><div style={{flex:1}}><label style={labelStyle}>Customer Phone</label><input type="tel" value={formData.customerPhone||""} onChange={e=>setFormData({...formData,customerPhone:e.target.value})} placeholder="(555) 555-5555" style={inputStyle}/></div></div>
              <div><label style={labelStyle}>Job Address</label><AddressInput value={formData.jobAddress} onChange={e=>setFormData({...formData,jobAddress:e.target.value})} style={inputStyle}/><div style={{fontSize:"11px",color:t.textMuted,marginTop:"4px"}}>Start typing and select from suggestions</div></div>
              <div><label style={labelStyle}>Job Description</label><BulletTextarea value={formData.jobDescription} onChange={e=>setFormData({...formData,jobDescription:e.target.value})} placeholder="Describe the work... (Enter for bullets)" style={inputStyle}/></div>
              <div><label style={labelStyle}>Materials Required</label><BulletTextarea value={formData.materials} onChange={e=>setFormData({...formData,materials:e.target.value})} placeholder="List materials... (Enter for bullets)" style={inputStyle}/></div>
              <div><label style={labelStyle}>Special Notes</label><BulletTextarea value={formData.specialNotes} onChange={e=>setFormData({...formData,specialNotes:e.target.value})} placeholder="Any special instructions..." style={inputStyle}/></div>
              <div><label style={labelStyle}>Attachments</label><input ref={fileRef} type="file" multiple onChange={e=>handleUpload(e,formData,setFormData)} style={{display:"none"}}/>
                <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{...baseBtn,background:t.card,border:`1.5px solid ${t.border}`,color:t.text,padding:"12px 16px",fontSize:"14px",width:"100%",gap:"6px"}}><PaperclipIcon/> {uploading?"Uploading...":"Add Attachments"}</button>
                {formData.attachments?.length>0&&<div style={{marginTop:"10px",display:"flex",flexDirection:"column",gap:"6px"}}>{formData.attachments.map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:t.card,padding:"8px 12px",borderRadius:"8px"}}><span style={{fontSize:"13px",display:"flex",alignItems:"center",gap:"4px"}}><PaperclipIcon/>{a.name}</span><button onClick={()=>setFormData({...formData,attachments:formData.attachments.filter((_,x)=>x!==i)})} style={{...ghostBtn,padding:"4px",color:t.danger}}><TrashIcon/></button></div>)}</div>}
              </div>
              <div style={{display:"flex",gap:"10px",marginTop:"4px"}}>
                <button onClick={()=>{setShowForm(false);setEditingOrder(null);}} style={{...baseBtn,flex:1,background:t.card,border:`1.5px solid ${t.border}`,color:t.textMuted,padding:"14px"}}>Cancel</button>
                <button onClick={saveCrew} style={{...primaryBtn,flex:2}}>{editingOrder!==null?"Update":"Create Order"}</button>
              </div>
            </div>
          </div>
        ):(
          <>
            <h2 style={{fontFamily:"'Playfair Display', serif",fontSize:"22px",color:t.text,margin:"0 0 4px"}}>Today's Orders</h2>
            <p style={{color:t.textMuted,fontSize:"13px",margin:"0 0 16px"}}>{todayCrew.length} active</p>
            {todayCrew.length===0?<div style={{textAlign:"center",padding:"48px 20px"}}><div style={{fontSize:"15px",color:t.textMuted}}>No work orders for today</div><div style={{fontSize:"13px",color:t.textMuted,marginTop:"6px"}}>Tap "New" to create one</div></div>
            :<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              {todayCrew.map(order=>{const ri=orders.indexOf(order);return(
                <div key={ri} style={{background:t.card,border:`1.5px solid ${t.border}`,borderRadius:"12px",padding:"16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                    <span style={{fontSize:"12px",background:t.accent,color:"#fff",padding:"3px 10px",borderRadius:"20px",fontWeight:700}}>{order.crewName}</span>
                    <div style={{display:"flex",gap:"4px"}}>
                      <button onClick={()=>handlePrint(order)} style={{...ghostBtn,padding:"6px"}}><PrintIcon/></button>
                      <button onClick={()=>{setFormData({...emptyCrewOrder,...order,members:order.members||[],attachments:order.attachments||[]});setEditingOrder(ri);setShowForm(true);}} style={{...ghostBtn,padding:"6px"}}><EditIcon/></button>
                      <button onClick={()=>setDeleteConfirm(ri)} style={{...ghostBtn,padding:"6px",color:t.danger}}><TrashIcon/></button>
                    </div>
                  </div>
                  {order.members?.length>0&&<div style={{fontSize:"14px",fontWeight:700,color:t.text,marginBottom:"4px"}}>{order.members.join(", ")}</div>}
                  <div style={{fontSize:"14px",color:t.text,marginBottom:"4px"}}>{order.jobAddress}</div>
                  {order.customerName&&<div style={{fontSize:"12px",color:t.textMuted,marginBottom:"2px"}}><UserIcon/> {order.customerName}</div>}
                  <div style={{fontSize:"13px",color:t.textMuted,lineHeight:1.5}}>{order.jobDescription?(order.jobDescription.length>100?order.jobDescription.slice(0,100)+"...":order.jobDescription):"No description"}</div>
                  {order.attachments?.length>0&&<div style={{marginTop:"8px",display:"flex",gap:"4px",flexWrap:"wrap"}}>{order.attachments.map((a,i)=><span key={i} style={{fontSize:"11px",background:t.tag,padding:"3px 8px",borderRadius:"6px",display:"flex",alignItems:"center",gap:"3px"}}><PaperclipIcon/>{a.name}</span>)}</div>}
                </div>);})}
            </div>}
          </>
        )}
      </div>
    </div>
  );
}
