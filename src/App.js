import React, { useState, useEffect, useCallback, useRef } from "react";
import { db, ref, set, onValue, storage, storageRef, uploadBytes, getDownloadURL, auth, signInAnonymously, onAuthStateChanged } from "./firebase";
import { SkeletonScreen, SkeletonOrderList, SkeletonStyles, OfflineBanner } from "./Skeletons";
import { generateReferenceId, ensureReferenceId } from "./refId";
import { FREQUENCIES, nextDate, todayStr as recurringTodayStr, dueTemplates, orderFromTemplate } from "./recurring";
import MiniCalendar from "./MiniCalendar";
import { logActivity, logConfirmation, iconFor as activityIcon } from "./historyLog";
import { requestPermissionAndRegisterToken, localNotify } from "./notifications";
import MaterialsRequestForm from "./MaterialsRequestForm";
import MaterialsManagerPanel from "./MaterialsManagerPanel";
import { AIPillButton, GenerateDescriptionDialog, SuggestMaterialsDialog, VoiceToOrderDialog } from "./AIControls";

// ── ONLINE/OFFLINE HOOK ─────────────────────────────────────────────────────
function useOnline(){
  const[online,setOnline]=useState(typeof navigator==="undefined"?true:navigator.onLine);
  useEffect(()=>{
    const on=()=>setOnline(true);const off=()=>setOnline(false);
    window.addEventListener("online",on);window.addEventListener("offline",off);
    return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};
  },[]);
  return online;
}

const GOOGLE_API_KEY = "AIzaSyDP9N998QacTADs3UaDYBohltD3rfflMmE";
const LOGO_SRC = "/logo.jpg";
const ALL_MEMBERS = ["Luis","Azael","Oswaldo","Andres","Vicente","Gabriel","Geovanny"];
const DEFAULT_CREWS = {"Crew 1":[...ALL_MEMBERS],"Crew 2":[...ALL_MEMBERS],"Crew 3":[...ALL_MEMBERS],"Crew 4":[...ALL_MEMBERS],"Crew 5":[...ALL_MEMBERS]};
const FIELD_OPS_MEMBERS = ["Joe","Bryan"];
const DEFAULT_PIN = "1234";
const DEFAULT_CREW_PIN = "5678";
const AUTH_KEY = "wo-auth-granted";

// ── COPILOT-INSPIRED THEME ──────────────────────────────────────────────────
// Background:   #0D0F1A  deep blue-black
// Cards:        #131929  slightly lighter navy
// Sidebar/nav:  #161D2E  elevated navy
// Borders:      #1E2845  subtle blue border
// Text:         #F0F4FF  near-white with blue tint
// Muted:        #4A5A7A  blue-gray muted
// Blue accent:  #4F7FFF  primary blue (active states, links)
// Green:        #4ADE80  lime green (success, goals, positive)
// Amber/Orange: #F59E0B  budgets, warnings
// Red/Danger:   #F43F5E  delete, over-budget
// Purple:       #A78BFA  field ops, secondary accent
// Cyan:         #22D3EE  highlights, codes
// Gold:         #F59E0B  manager/admin accent
const t={
  bg:"#0D0F1A",
  card:"#131929",
  nav:"#161D2E",
  line:"#1E2845",
  text:"#F0F4FF",
  muted:"#4A5A7A",
  blue:"#4F7FFF",
  green:"#4ADE80",
  amber:"#F59E0B",
  danger:"#F43F5E",
  purple:"#A78BFA",
  cyan:"#22D3EE",
  inputBg:"#0A0D18",
  tag:"#161D2E",
  red:"#E8192C",
};

const ff = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const baseBtn={border:"none",borderRadius:"10px",cursor:"pointer",fontFamily:ff,fontWeight:600,transition:"all 0.15s ease",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"};
const primaryBtn={...baseBtn,background:`linear-gradient(135deg,#3B6FEF 0%,#5B9BFF 100%)`,color:"#fff",padding:"14px 24px",fontSize:"15px",boxShadow:"0 0 20px rgba(79,127,255,.3)"};
const ghostBtn={...baseBtn,background:"transparent",color:t.muted,padding:"10px 16px",fontSize:"14px"};
const inputStyle={width:"100%",padding:"14px 16px",background:t.inputBg,border:`1.5px solid ${t.line}`,borderRadius:"10px",color:t.text,fontSize:"16px",fontFamily:ff,outline:"none",boxSizing:"border-box",transition:"border-color 0.15s"};
const labelStyle={display:"block",fontSize:"11px",fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:"1.4px",marginBottom:"8px"};

// ── APP GATE ────────────────────────────────────────────────────────────────
function AppGate({children}){
  // Global gate removed - app is open, manager actions protected by individual PinDialogs
  const[authed,setAuthed]=useState(true);
  const[pin,setPin]=useState("");
  const[err,setErr]=useState(false);
  const[shake,setShake]=useState(false);
  const[firebaseUser,setFirebaseUser]=useState(null);
  const[authLoading,setAuthLoading]=useState(true);
  const[storedManagerPin,setStoredManagerPin]=useState(DEFAULT_PIN);
  const[storedCrewPin,setStoredCrewPin]=useState(DEFAULT_CREW_PIN);
  const[pinsLoaded,setPinsLoaded]=useState(false);

  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,user=>{
      setFirebaseUser(user);setAuthLoading(false);
      if(!user){signInAnonymously(auth).catch(e=>console.error("Anon sign in:",e));}
    });
    return()=>unsub();
  },[]);

  useEffect(()=>{
    if(!firebaseUser)return;
    const u1=onValue(ref(db,"settings/managerPin"),s=>{if(s.val())setStoredManagerPin(s.val());});
    const u2=onValue(ref(db,"settings/crewPin"),s=>{if(s.val())setStoredCrewPin(s.val());setPinsLoaded(true);});
    const timer=setTimeout(()=>setPinsLoaded(true),2000);
    return()=>{u1();u2();clearTimeout(timer);};
  },[firebaseUser]);

  const check=()=>{
    if(pin===storedManagerPin||pin===storedCrewPin){
      localStorage.setItem(AUTH_KEY,"true");setAuthed(true);
    } else {
      setErr(true);setShake(true);setPin("");
      setTimeout(()=>{setErr(false);setShake(false);},2000);
    }
  };

  if(authLoading)return(<SkeletonScreen rows={4}/>);

  if(authed)return children;

  return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:ff,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"}}>
      <style>{`
        @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <div style={{width:"100%",maxWidth:"340px",textAlign:"center",animation:"fadeUp 0.4s ease"}}>
        <h1 style={{fontSize:"22px",color:t.red,fontWeight:700,letterSpacing:".5px",margin:"0 0 4px",textTransform:"uppercase"}}>ICON REMODELING GROUP INC.</h1>
        <p style={{color:"#ffffff",fontSize:"11px",letterSpacing:"4px",textTransform:"uppercase",margin:"0 0 32px",opacity:.8}}>Work Orders</p>
        <div style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"18px",padding:"28px",boxShadow:"0 8px 32px rgba(0,0,0,.5)"}}>
          <div style={{fontSize:"12px",fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:"1.4px",marginBottom:"16px"}}>Enter Access PIN</div>
          <input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")check();}} placeholder="••••" autoFocus
            style={{width:"100%",padding:"16px",background:t.inputBg,border:`2px solid ${err?t.danger:t.line}`,borderRadius:"12px",color:t.text,fontSize:"28px",outline:"none",boxSizing:"border-box",textAlign:"center",letterSpacing:"10px",marginBottom:"12px",animation:shake?"shake 0.4s ease":"none",transition:"border-color 0.2s",fontFamily:ff}}
          />
          {err&&<div style={{color:t.danger,fontSize:"13px",fontWeight:600,marginBottom:"12px"}}>Incorrect PIN — try again</div>}
          <button onClick={check} disabled={!pinsLoaded} style={{...primaryBtn,width:"100%",padding:"14px",justifyContent:"center",opacity:pinsLoaded?1:0.5,cursor:pinsLoaded?"pointer":"not-allowed"}}>
            {pinsLoaded?"Enter":"Connecting..."}
          </button>
        </div>
        <p style={{color:t.muted,fontSize:"12px",marginTop:"20px"}}>Contact your manager if you need access.</p>
      </div>
    </div>
  );
}

const emptyJob={customerName:"",customerPhone:"",jobTreadName:"",jobAddress:"",jobDescription:"",materials:"",specialNotes:"",attachments:[]};
const emptyCrewOrder={crewName:"",members:[],date:new Date().toISOString().split("T")[0],jobs:[{...emptyJob}],recurring:{enabled:false,frequency:"Weekly",until:""}};
// Backward compat: convert old flat order to jobs array
function getJobsForOrder(order){if(order.jobs&&order.jobs.length>0)return order.jobs;return[{customerName:order.customerName||"",customerPhone:order.customerPhone||"",jobTreadName:order.jobTreadName||"",jobAddress:order.jobAddress||"",jobDescription:order.jobDescription||"",materials:order.materials||"",specialNotes:order.specialNotes||"",attachments:order.attachments||[]}];}
const emptyFieldOrder={staffMember:[],todaysTasks:"",jobRequests:"",date:new Date().toISOString().split("T")[0],attachments:[],fieldNotes:[]};

function saveToFB(path,data){set(ref(db,path),data).catch(e=>console.error("FB save:",e));}
function useFB(path,fb){const[d,setD]=useState(fb);const[l,setL]=useState(false);useEffect(()=>{const u=onValue(ref(db,path),s=>{const v=s.val();setD(v!==null?v:fb);setL(true);},()=>setL(true));return()=>u();},[path]);return[d,l];}
function isExpired(order){const now=new Date();const od=new Date(order.date+"T06:00:00");const ex=new Date(od);ex.setDate(ex.getDate()+1);return now>=ex;}
function getActive(orders){return(orders||[]).filter(o=>!isExpired(o));}
function getArchived(orders){return(orders||[]).filter(o=>isExpired(o));}

// SVG Icons
const ic=(d,w=20)=><svg width={w} height={w} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">{d}</svg>;
const PlusIcon=()=>ic(<path d="M12 5v14M5 12h14"/>,20);
const BackIcon=()=>ic(<path d="M15 18l-6-6 6-6"/>,20);
const HomeIcon=()=>ic(<><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>);
const TrashIcon=()=>ic(<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/>,18);
const EditIcon=()=>ic(<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,18);
const MapIcon=()=>ic(<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></>,16);
const CheckIcon=()=>ic(<path d="M20 6L9 17l-5-5"/>,16);
const SettingsIcon=()=>ic(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>);
const SearchIcon=()=>ic(<><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></>,16);
const PaperclipIcon=()=>ic(<path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>,16);
const ArchiveIcon=()=>ic(<><path d="M21 8v13H3V8M1 3h22v5H1z"/><path d="M10 12h4"/></>);
const PrintIcon=()=>ic(<><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>,18);
const LockIcon=()=>ic(<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>);
const UserIcon=()=>ic(<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,14);
const PhoneIcon=()=>ic(<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>,14);
const CameraIcon=()=>ic(<><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></>);
const KeyIcon=()=>ic(<><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></>);
const WifiIcon=()=>ic(<><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></>,18);
const XIcon=()=>ic(<path d="M18 6L6 18M6 6l12 12"/>,18);
const DoorIcon=()=>ic(<><path d="M3 21h18M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"/><path d="M14 12a1 1 0 100-2 1 1 0 000 2z" fill="currentColor" stroke="none"/></>,18);
const GarageIcon=()=>ic(<><path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/><path d="M9 12h6"/><path d="M9 15h6"/></>,18);
const DotsIcon=()=>ic(<><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></>,16);

function getFileType(url,name){
  // Check name first, then fall back to URL for extension
  const fromName=(name||"").split(".").pop().toLowerCase();
  const fromUrl=(url||"").split("?")[0].split(".").pop().toLowerCase();
  const ext=fromName.length>0&&fromName!==name?fromName:fromUrl;
  if(["jpg","jpeg","png","gif","webp","svg","heic","heif"].includes(ext))return"image";
  if(ext==="pdf")return"pdf";
  if(["doc","docx","xls","xlsx","ppt","pptx","txt","csv"].includes(ext))return"office";
  return"unknown";
}

function FileViewer({file,onClose}){
  const url=file.url;const name=file.name||"Attachment";
  const type=getFileType(url,name);
  const ff="'DM Sans',sans-serif";
  const[pdfPages,setPdfPages]=React.useState([]);
  const[pdfLoading,setPdfLoading]=React.useState(false);
  const[pdfError,setPdfError]=React.useState(false);
  const fileIcons={"image":"🖼️","pdf":"📄","office":"📋","unknown":"📎"};
  const fileLabels={"image":"Image","pdf":"PDF Document","office":"Document","unknown":"File"};

  React.useEffect(()=>{
    if(type!=="pdf")return;
    setPdfLoading(true);setPdfPages([]);setPdfError(false);
    const load=async()=>{
      try{
        if(!window.pdfjsLib){
          await new Promise((res,rej)=>{
            const s=document.createElement("script");
            s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";res();}
            s.onerror=rej;document.head.appendChild(s);
          });
        }
        const pdf=await window.pdfjsLib.getDocument(url).promise;
        const pages=[];
        for(let p=1;p<=pdf.numPages;p++){
          const page=await pdf.getPage(p);
          const vp=page.getViewport({scale:2.0});
          const canvas=document.createElement("canvas");
          canvas.width=vp.width;canvas.height=vp.height;
          const ctx=canvas.getContext("2d");
          await page.render({canvasContext:ctx,viewport:vp}).promise;
          pages.push(canvas.toDataURL("image/jpeg",0.92));
        }
        setPdfPages(pages);
      }catch(e){console.error("PDF render error:",e);setPdfError(true);}
      finally{setPdfLoading(false);}
    };
    load();
  },[url,type]);

  return(
    <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",flexDirection:"column",background:"#0D0F1A"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",background:"rgba(0,0,0,0.6)",backdropFilter:"blur(10px)",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",flex:1,minWidth:0,marginRight:"12px"}}>
          <span style={{fontSize:"18px"}}>{fileIcons[type]}</span>
          <div style={{minWidth:0}}>
            <div style={{fontSize:"13px",fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
            <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)",marginTop:"1px"}}>
              {fileLabels[type]}
              {type==="pdf"&&pdfPages.length>0&&<span style={{marginLeft:"6px"}}>· {pdfPages.length} page{pdfPages.length!==1?"s":""}</span>}
              {file.converted&&<span style={{marginLeft:"6px",fontSize:"10px",background:"rgba(74,222,128,0.2)",color:"#4ade80",padding:"1px 6px",borderRadius:"4px",fontWeight:700}}>CONVERTED</span>}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"10px",color:"#fff",padding:"8px 14px",fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:ff,flexShrink:0}}>✕ Close</button>
      </div>
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
        {type==="image"&&(
          <div style={{width:"100%",minHeight:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",boxSizing:"border-box",background:"#0a0a0a"}}>
            <img src={url} alt={name} style={{maxWidth:"100%",borderRadius:"10px",boxShadow:"0 8px 32px rgba(0,0,0,0.6)"}}/>
          </div>
        )}
        {type==="pdf"&&(
          <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:"12px",alignItems:"center"}}>
            {pdfLoading&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 20px",gap:"16px"}}>
                <div style={{width:"36px",height:"36px",border:"3px solid rgba(255,255,255,0.1)",borderTop:"3px solid #4F7FFF",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
                <div style={{color:"rgba(255,255,255,0.5)",fontSize:"13px",fontFamily:ff}}>Loading PDF pages...</div>
              </div>
            )}
            {!pdfLoading&&pdfError&&(
              <div style={{textAlign:"center",padding:"48px 20px"}}>
                <div style={{fontSize:"48px",marginBottom:"16px"}}>⚠️</div>
                <div style={{color:"#fff",fontSize:"16px",fontWeight:700,marginBottom:"8px",fontFamily:ff}}>Could not render PDF</div>
                <a href={url} onClick={e=>{e.preventDefault();window.location.href=url;}} style={{display:"inline-block",marginTop:"16px",padding:"12px 24px",background:"#4F7FFF",borderRadius:"10px",color:"#fff",fontSize:"14px",fontWeight:700,textDecoration:"none",fontFamily:ff}}>Open in Browser</a>
              </div>
            )}
            {!pdfLoading&&pdfPages.map((src,i)=>(
              <div key={i} style={{width:"100%",maxWidth:"700px"}}>
                {pdfPages.length>1&&<div style={{fontSize:"11px",color:"rgba(255,255,255,0.35)",fontFamily:ff,marginBottom:"6px",textAlign:"center",fontWeight:600,letterSpacing:"1px"}}>PAGE {i+1} OF {pdfPages.length}</div>}
                <img src={src} alt={`Page ${i+1}`} style={{width:"100%",borderRadius:"8px",boxShadow:"0 4px 20px rgba(0,0,0,0.5)",display:"block"}}/>
              </div>
            ))}
          </div>
        )}
        {(type==="office"||type==="unknown")&&(()=>{
          const ext=((name||"").split(".").pop()||"").toUpperCase();
          return(
            <div style={{width:"100%",minHeight:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px",boxSizing:"border-box",textAlign:"center"}}>
              <div style={{fontSize:"64px",marginBottom:"20px"}}>{fileIcons[type]}</div>
              <div style={{fontSize:"18px",fontWeight:700,color:"#fff",marginBottom:"16px",fontFamily:ff,wordBreak:"break-word",maxWidth:"320px"}}>{name}</div>
              <div style={{fontSize:"14px",color:"rgba(255,255,255,0.7)",fontFamily:ff,maxWidth:"320px",lineHeight:1.6,padding:"16px 20px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:"12px"}}>
                This file was uploaded as a {ext||"document"} document. For best viewing, ask your manager to re-upload it as a PDF or image.
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Reusable attachment card: image thumbnail (if image), file icon, name, View button ──
// theme="dark" for the in-app dark UI; theme="light" for WorkOrderDoc / printed-style surfaces.
function AttachmentCard({attachment,onOpen,theme="dark"}){
  const url=attachment.url;
  const name=attachment.name||"Attachment";
  const type=getFileType(url,name);
  const ext=((name||"").split(".").pop()||"").toUpperCase();
  const ffLocal="'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  const icons={image:"🖼️",pdf:"📄",office:"📋",unknown:"📎"};
  const dark=theme==="dark";
  const colors=dark
    ?{bg:"#131929",border:"#1E2845",text:"#F0F4FF",muted:"#8B96B0",btn:"#4F7FFF",btnText:"#fff",noticeBg:"rgba(245,158,11,0.08)",noticeBorder:"rgba(245,158,11,0.25)",noticeText:"#F5C77E"}
    :{bg:"#F2F4F6",border:"#D6D9DE",text:"#1F2329",muted:"#5F6670",btn:"#0077C8",btnText:"#fff",noticeBg:"#FFF8E6",noticeBorder:"#E6C57A",noticeText:"#7A5A00"};

  if(type==="office"){
    return(
      <div style={{background:colors.bg,border:`1px solid ${colors.border}`,borderRadius:"10px",padding:"12px 14px",display:"flex",flexDirection:"column",gap:"8px",fontFamily:ffLocal}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <span style={{fontSize:"18px"}}>{icons.office}</span>
          <span style={{flex:1,minWidth:0,fontSize:"13px",fontWeight:600,color:colors.text,wordBreak:"break-word"}}>{name}</span>
        </div>
        <div style={{fontSize:"12px",color:colors.noticeText,lineHeight:1.5,padding:"10px 12px",background:colors.noticeBg,border:`1px solid ${colors.noticeBorder}`,borderRadius:"8px"}}>
          This file was uploaded as a {ext||"document"} document. For best viewing, ask your manager to re-upload it as a PDF or image.
        </div>
      </div>
    );
  }

  return(
    <div style={{background:colors.bg,border:`1px solid ${colors.border}`,borderRadius:"10px",padding:"10px",display:"flex",flexDirection:"column",gap:"8px",fontFamily:ffLocal}}>
      {type==="image"&&(
        <button type="button" onClick={onOpen} style={{padding:0,border:"none",background:"#000",borderRadius:"8px",overflow:"hidden",cursor:"pointer",display:"block",width:"100%"}}>
          <img src={url} alt={name} style={{width:"100%",maxHeight:"80px",objectFit:"cover",display:"block"}}/>
        </button>
      )}
      <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
        <span style={{fontSize:"18px",flexShrink:0}}>{icons[type]||icons.unknown}</span>
        <span style={{flex:1,minWidth:0,fontSize:"13px",fontWeight:600,color:colors.text,wordBreak:"break-word"}}>{name}</span>
        <button type="button" onClick={onOpen} style={{background:colors.btn,color:colors.btnText,border:"none",borderRadius:"6px",padding:"6px 14px",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:ffLocal,flexShrink:0}}>View</button>
      </div>
    </div>
  );
}

// ── Smart file processor: images pass through, PDFs convert to image, Office files warn ──
async function processFileForUpload(file,showToastFn){
  const ext=file.name.split(".").pop().toLowerCase();
  const imageTypes=["jpg","jpeg","png","gif","webp","svg","heic","heif"];
  const officeTypes=["doc","docx","xls","xlsx","ppt","pptx"];

  // Images — pass straight through
  if(imageTypes.includes(ext)||file.type.startsWith("image/"))return{file,warn:null};

  // PDFs — convert first page to image using PDF.js
  if(ext==="pdf"||file.type==="application/pdf"){
    try{
      // Load PDF.js if not already loaded
      if(!window.pdfjsLib){
        await new Promise((res,rej)=>{
          const s=document.createElement("script");
          s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";res();}
          s.onerror=rej;document.head.appendChild(s);
        });
      }
      const arrayBuffer=await file.arrayBuffer();
      const pdf=await window.pdfjsLib.getDocument({data:arrayBuffer}).promise;
      const numPages=pdf.numPages;
      const blobs=[];
      for(let p=1;p<=numPages;p++){
        const page=await pdf.getPage(p);
        const vp=page.getViewport({scale:2.0});
        const canvas=document.createElement("canvas");
        canvas.width=vp.width;canvas.height=vp.height;
        const ctx=canvas.getContext("2d");
        await page.render({canvasContext:ctx,viewport:vp}).promise;
        const blob=await new Promise(res=>canvas.toBlob(res,"image/jpeg",0.92));
        blobs.push(blob);
      }
      if(blobs.length===1){
        const imgFile=new File([blobs[0]],file.name.replace(/\.pdf$/i,".jpg"),{type:"image/jpeg"});
        return{file:imgFile,warn:null,wasConverted:true};
      } else {
        // Multi-page: return array of files
        const imgFiles=blobs.map((b,i)=>new File([b],file.name.replace(/\.pdf$/i,`_page${i+1}.jpg`),{type:"image/jpeg"}));
        return{files:imgFiles,warn:null,wasConverted:true,multiPage:true};
      }
    }catch(err){
      console.error("PDF conversion failed:",err);
      // Fall through — upload original PDF
      return{file,warn:null};
    }
  }

  // Office files — warn and upload original
  if(officeTypes.includes(ext)){
    return{file,warn:`"${file.name}" is a ${ext.toUpperCase()} file. For best mobile viewing, save as PDF before uploading. Uploading original.`};
  }

  // Everything else — pass through
  return{file,warn:null};
}

// ── PROFESSIONAL WORK ORDER DOCUMENT COMPONENT ───────────────────────────────
function WorkOrderDoc({order,onClose,onFileOpen}){
  const jobs=getJobsForOrder(order);
  const members=(order.members||order.staffMember||[]).join(", ");
  const isField=!!(order.staffMember);
  const ff="'DM Sans',sans-serif";
  const[activeTab,setActiveTab]=React.useState(0);

  // ── BRAND COLORS ──────────────────────────────────────────────
  const brand={
    black:"#000000",
    charcoal:"#1F2329",
    blue:"#0077C8",
    lightGray:"#F2F4F6",
    borderGray:"#D6D9DE",
    bodyText:"#1F2329",
    labelText:"#5F6670",
    white:"#FFFFFF",
  };

  const tabColors=[brand.blue,"#0055A0","#003D78"];

  const SectionBar=({emoji,title,color})=>(
    <div style={{background:color||brand.blue,padding:"9px 18px",display:"flex",alignItems:"center",gap:"8px",borderTop:`1px solid ${brand.borderGray}`}}>
      <span style={{fontSize:"14px"}}>{emoji}</span>
      <span style={{fontSize:"11px",fontWeight:800,textTransform:"uppercase",letterSpacing:"1.2px",color:brand.white}}>{title}</span>
    </div>
  );

  const InfoCell=({label,value,span,borderRight})=>(
    <div style={{padding:"12px 18px",borderRight:borderRight?`1px solid ${brand.borderGray}`:"none",borderBottom:`1px solid ${brand.borderGray}`,gridColumn:span?"1/-1":"auto"}}>
      <div style={{fontSize:"10px",fontWeight:700,color:brand.labelText,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:"4px"}}>{label}</div>
      <div style={{fontSize:"14px",fontWeight:600,color:brand.bodyText}}>{value||"—"}</div>
    </div>
  );

  const JobSection=({job,jobIdx,color})=>(
    <div>
      {/* Job header band (only for multi-job) */}
      {jobs.length>1&&<div style={{background:color,padding:"10px 18px",display:"flex",alignItems:"center",gap:"10px",borderTop:`2px solid ${brand.borderGray}`}}>
        <div style={{width:"24px",height:"24px",borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:900,color:brand.white}}>{jobIdx+1}</div>
        <div>
          <div style={{fontSize:"12px",fontWeight:800,color:brand.white,textTransform:"uppercase",letterSpacing:"1px"}}>Job {jobIdx+1}</div>
          {job.customerName&&<div style={{fontSize:"11px",color:"rgba(255,255,255,0.75)",marginTop:"1px"}}>{job.customerName}</div>}
        </div>
      </div>}

      {/* Info grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",background:brand.white}}>
        {job.customerName&&<InfoCell label="Customer" value={job.customerName} borderRight/>}
        {job.customerPhone&&<InfoCell label="Phone" value={job.customerPhone}/>}
        {job.jobAddress&&<div style={{padding:"12px 18px",borderBottom:`1px solid ${brand.borderGray}`,gridColumn:"1/-1"}}>
          <div style={{fontSize:"10px",fontWeight:700,color:brand.labelText,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:"4px"}}>Job Address</div>
          <a href={getMapsUrl(job.jobAddress)} style={{fontSize:"14px",fontWeight:600,color:brand.blue,textDecoration:"none",display:"flex",alignItems:"center",gap:"6px"}}>{job.jobAddress} <MapIcon/></a>
        </div>}
      </div>

      {/* Work / Tasks */}
      {job.jobDescription&&<><SectionBar emoji="🔨" title="Work / Tasks"/>
        <div style={{padding:"14px 18px",background:brand.lightGray,borderBottom:`1px solid ${brand.borderGray}`}}>
          <div style={{fontSize:"14px",color:brand.bodyText,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{renderBullet(job.jobDescription)}</div>
        </div>
      </>}

      {/* Materials */}
      {job.materials&&<><SectionBar emoji="📦" title="Materials Required"/>
        <div style={{padding:"14px 18px",background:brand.white,borderBottom:`1px solid ${brand.borderGray}`}}>
          <div style={{fontSize:"14px",color:brand.bodyText,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{renderBullet(job.materials)}</div>
        </div>
      </>}

      {/* Special Notes */}
      {job.specialNotes&&<><SectionBar emoji="⚠️" title="Special Notes"/>
        <div style={{padding:"14px 18px",background:brand.lightGray,borderBottom:`1px solid ${brand.borderGray}`}}>
          <div style={{fontSize:"14px",color:brand.bodyText,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{renderBullet(job.specialNotes)}</div>
        </div>
      </>}

      {/* Attachments */}
      {job.attachments?.length>0&&<><SectionBar emoji="📎" title="Attachments / Files"/>
        <div style={{padding:"14px 18px",background:brand.white,borderBottom:`1px solid ${brand.borderGray}`}}>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {job.attachments.map((a,i)=>(
              <AttachmentCard key={i} attachment={a} onOpen={()=>onFileOpen&&onFileOpen(a)} theme="light"/>
            ))}
          </div>
        </div>
      </>}
    </div>
  );

  return(
    <div style={{position:"fixed",inset:0,zIndex:2000,overflowY:"auto",WebkitOverflowScrolling:"touch",background:brand.lightGray}}>
      <div style={{maxWidth:"720px",margin:"0 auto",minHeight:"100vh",background:brand.white,boxShadow:"0 0 40px rgba(0,0,0,0.12)"}}>

        {/* ── HEADER ── */}
        <div style={{background:brand.black,padding:"0"}}>
          {/* Top banner */}
          <div style={{padding:"20px 24px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:"22px",fontWeight:900,color:brand.white,letterSpacing:"2px",textTransform:"uppercase",marginBottom:"2px"}}>ICON REMODELING GROUP INC.</div>
              <div style={{fontSize:"11px",fontWeight:600,color:brand.blue,letterSpacing:"3px",textTransform:"uppercase"}}>Daily Work Order</div>
            </div>
            {onClose&&<button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:`1px solid rgba(255,255,255,0.25)`,borderRadius:"8px",color:brand.white,padding:"8px 16px",fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:ff,flexShrink:0,marginLeft:"16px"}}>← Back</button>}
          </div>
          {/* Blue accent bar */}
          <div style={{height:"4px",background:brand.blue}}/>
          {/* Badge row */}
          <div style={{padding:"10px 24px",display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
            <span style={{background:brand.blue,color:brand.white,fontSize:"11px",fontWeight:800,padding:"4px 14px",borderRadius:"20px",letterSpacing:"1.5px",textTransform:"uppercase"}}>{isField?"Field Operations":"Crew Assignment"}</span>
            {order.referenceId&&<span style={{background:"rgba(255,255,255,0.12)",color:brand.white,fontSize:"11px",fontWeight:700,padding:"4px 12px",borderRadius:"6px",letterSpacing:".5px",fontFamily:"monospace",border:"1px solid rgba(255,255,255,0.2)"}}>{order.referenceId}</span>}
          </div>
        </div>

        {/* ── DATE + CREW ── */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",background:brand.charcoal}}>
          <div style={{padding:"14px 18px",borderRight:`1px solid rgba(255,255,255,0.1)`}}>
            <div style={{fontSize:"10px",fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:"4px"}}>Date</div>
            <div style={{fontSize:"15px",fontWeight:700,color:brand.white}}>{order.date||"—"}</div>
          </div>
          <div style={{padding:"14px 18px"}}>
            <div style={{fontSize:"10px",fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:"4px"}}>{isField?"Staff Member":"Crew / Members"}</div>
            <div style={{fontSize:"15px",fontWeight:700,color:brand.white}}>{members||order.crewName||"—"}</div>
          </div>
        </div>

        {/* Blue divider */}
        <div style={{height:"3px",background:brand.blue}}/>

        {/* ── JOB TABS (multi-job only) ── */}
        {jobs.length>1&&<div style={{display:"flex",borderBottom:`2px solid ${brand.borderGray}`,background:brand.lightGray,overflowX:"auto"}}>
          {jobs.map((job,i)=>(
            <button key={i} onClick={()=>setActiveTab(i)} style={{padding:"11px 20px",border:"none",borderBottom:activeTab===i?`3px solid ${brand.blue}`:"3px solid transparent",background:"transparent",fontSize:"13px",fontWeight:700,color:activeTab===i?brand.blue:brand.labelText,cursor:"pointer",fontFamily:ff,whiteSpace:"nowrap",marginBottom:"-2px",transition:"all 0.15s"}}>
              Job {i+1}{job.customerName?` — ${job.customerName}`:""}
            </button>
          ))}
          <button onClick={()=>setActiveTab(-1)} style={{padding:"11px 16px",border:"none",borderBottom:activeTab===-1?`3px solid ${brand.charcoal}`:"3px solid transparent",background:"transparent",fontSize:"12px",fontWeight:700,color:activeTab===-1?brand.charcoal:brand.labelText,cursor:"pointer",fontFamily:ff,whiteSpace:"nowrap",marginBottom:"-2px"}}>
            View All
          </button>
        </div>}

        {/* ── JOB CONTENT ── */}
        {jobs.length===1
          ?<JobSection job={jobs[0]} jobIdx={0} color={brand.blue}/>
          :activeTab===-1
            ?jobs.map((job,i)=><div key={i}><JobSection job={job} jobIdx={i} color={tabColors[i]||brand.blue}/></div>)
            :<JobSection job={jobs[activeTab]} jobIdx={activeTab} color={tabColors[activeTab]||brand.blue}/>
        }

        {/* ── FOOTER ── */}
        <div style={{height:"3px",background:brand.blue}}/>
        <div style={{background:brand.charcoal,padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)",fontWeight:600,letterSpacing:"1px",textTransform:"uppercase"}}>Icon Remodeling Group Inc.</div>
          <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)",fontWeight:600}}>Designed with Purpose | Built with Pride</div>
        </div>
      </div>
    </div>
  );
}

function getMapsUrl(a){const e=encodeURIComponent(a);return/iPad|iPhone|iPod/.test(navigator.userAgent)?`maps://maps.apple.com/?q=${e}`:`https://www.google.com/maps/search/?api=1&query=${e}`;}

function BulletTextarea({value,onChange,placeholder,style:s}){
  const taRef=useRef(null);
  const hk=e=>{if(e.key==="Enter"){e.preventDefault();const v=e.target.value;const p=e.target.selectionStart;const n=v.slice(0,p)+"\n\u2022 "+v.slice(p);onChange({target:{value:n}});setTimeout(()=>{if(taRef.current){taRef.current.selectionStart=taRef.current.selectionEnd=p+3;taRef.current.scrollTop=taRef.current.scrollHeight;}},0);}};
  const hc=e=>{let v=e.target.value;if(v&&!v.startsWith("\u2022")&&v.trim().length>0&&!value)v="\u2022 "+v;v=v.replace(/\u2022 ([a-z])/g,(m,c)=>"\u2022 "+c.toUpperCase());onChange({target:{value:v}});setTimeout(()=>{if(taRef.current)taRef.current.scrollTop=taRef.current.scrollHeight;},0);};
  return<textarea ref={taRef} value={value} onChange={hc} onKeyDown={hk} placeholder={placeholder} rows={3} style={{...s,resize:"vertical",minHeight:"80px"}}/>;
}

function AddressInput({value,onChange,style:s}){
  const[sug,setSug]=useState([]);const[show,setShow]=useState(false);const[tok,setTok]=useState(null);const[loaded,setLoaded]=useState(false);const debRef=useRef(null);const wRef=useRef(null);
  useEffect(()=>{if(window.google?.maps?.places){setLoaded(true);return;}const ex=document.querySelector(`script[src*="maps.googleapis.com"]`);if(ex){ex.addEventListener("load",()=>setLoaded(true));return;}const sc=document.createElement("script");sc.src=`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&loading=async`;sc.async=true;sc.defer=true;sc.onload=()=>setLoaded(true);document.head.appendChild(sc);},[]);
  useEffect(()=>{if(loaded&&window.google?.maps?.places)try{setTok(new window.google.maps.places.AutocompleteSessionToken());}catch(e){}},[loaded]);
  useEffect(()=>{const h=e=>{if(wRef.current&&!wRef.current.contains(e.target))setShow(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const fetch=useCallback(input=>{if(!loaded||!input||input.length<3){setSug([]);return;}try{new window.google.maps.places.AutocompleteService().getPlacePredictions({input,types:["address"],componentRestrictions:{country:"us"},sessionToken:tok},(p,st)=>{if(st===window.google.maps.places.PlacesServiceStatus.OK&&p){setSug(p.map(x=>({description:x.description})));setShow(true);}else setSug([]);});}catch(e){}},[loaded,tok]);
  const hc=e=>{onChange(e);if(debRef.current)clearTimeout(debRef.current);debRef.current=setTimeout(()=>fetch(e.target.value),300);};
  const hs=d=>{onChange({target:{value:d}});setShow(false);setSug([]);try{setTok(new window.google.maps.places.AutocompleteSessionToken());}catch(e){}};
  return(<div ref={wRef} style={{position:"relative"}}><input type="text" value={value} onChange={hc} onFocus={()=>{if(sug.length>0)setShow(true);}} placeholder="Start typing an address..." style={s}/>
    {show&&sug.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:t.nav,border:`1.5px solid ${t.line}`,borderRadius:"0 0 10px 10px",boxShadow:"0 4px 16px rgba(0,0,0,.5)",zIndex:100,maxHeight:"200px",overflowY:"auto"}}>
      {sug.map((x,i)=><div key={i} onClick={()=>hs(x.description)} style={{padding:"12px 16px",cursor:"pointer",fontSize:"14px",color:t.text,borderBottom:i<sug.length-1?`1px solid ${t.line}`:"none",display:"flex",alignItems:"center",gap:"8px"}} onMouseEnter={e=>e.currentTarget.style.background=t.tag} onMouseLeave={e=>e.currentTarget.style.background=t.nav}><SearchIcon/>{x.description}</div>)}</div>}</div>);
}

const renderBullet=text=>{if(!text)return"\u2014";return text.split("\n").map((l,i)=><div key={i} style={{marginBottom:"2px"}}>{l}</div>);};

function PinDialog({onSuccess,onCancel,title}){
  const[pin,setPin]=useState("");const[err,setErr]=useState(false);const[storedPin,setStoredPin]=useState(DEFAULT_PIN);
  useEffect(()=>{const u=onValue(ref(db,"settings/managerPin"),s=>{const v=s.val();if(v)setStoredPin(v);});return()=>u();},[]);
  const check=()=>{if(pin===storedPin){onSuccess();}else{setErr(true);setPin("");setTimeout(()=>setErr(false),2000);}};
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
    <div style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"18px",padding:"32px",maxWidth:"320px",width:"100%",textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,.6)"}}>
      <div style={{color:t.amber}}><LockIcon/></div>
      <h3 style={{margin:"12px 0 4px",fontSize:"18px",color:t.text,fontFamily:ff}}>{title||"Enter Manager PIN"}</h3>
      <p style={{fontSize:"13px",color:t.muted,marginBottom:"20px"}}>This area is protected</p>
      <input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")check();}} placeholder="Enter PIN" style={{...inputStyle,textAlign:"center",fontSize:"24px",letterSpacing:"8px",marginBottom:"12px"}}/>
      {err&&<div style={{color:t.danger,fontSize:"13px",marginBottom:"8px"}}>Incorrect PIN</div>}
      <div style={{display:"flex",gap:"10px"}}><button onClick={onCancel} style={{...baseBtn,flex:1,background:t.tag,color:t.muted,padding:"12px",border:`1px solid ${t.line}`}}>Cancel</button><button onClick={check} style={{...primaryBtn,flex:1,padding:"12px",justifyContent:"center"}}>Enter</button></div>
    </div>
  </div>);
}

function InfoModal({title,icon,children,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}} onClick={onClose}>
      <div style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"18px",padding:"28px",maxWidth:"340px",width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,.6)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px",color:t.text}}>{icon}<span style={{fontSize:"17px",fontWeight:700}}>{title}</span></div>
          <button onClick={onClose} style={{...ghostBtn,padding:"4px",color:t.muted}}><XIcon/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Header({title,subtitle,onBack,onHome,children}){
  return(
    <div className="no-print">
      <style>{`
        @media (max-width:359px){.header-back-text{display:none;}.header-back-btn{padding:6px 8px !important;}}
      `}</style>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${t.line}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:t.nav,gap:"8px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",minWidth:0,flex:"0 1 auto"}}>
          {onBack&&<button className="header-back-btn" onClick={onBack} style={{...ghostBtn,padding:"6px 10px",flexShrink:0,color:t.blue,display:"inline-flex",alignItems:"center",gap:"4px",fontSize:"13px",fontWeight:600}}><BackIcon/><span className="header-back-text">Previous Page</span></button>}
          <div style={{minWidth:0}}>
            <div style={{fontSize:"15px",fontWeight:700,color:t.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</div>
            {subtitle&&<div style={{fontSize:"11px",color:t.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{subtitle}</div>}
          </div>
        </div>
        <div style={{display:"flex",gap:"4px",alignItems:"center",flexShrink:0,justifyContent:"flex-end"}}>
          {children}
          {onHome&&<button onClick={onHome} style={{...ghostBtn,padding:"6px",color:t.muted}} title="Home"><HomeIcon/></button>}
        </div>
      </div>
    </div>);
}

// ── OVERFLOW MENU (⋮) — collapses overflow header actions on small screens ──
function OverflowMenu({items,color}){
  const[open,setOpen]=useState(false);
  const wrapRef=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const onDown=e=>{if(wrapRef.current&&!wrapRef.current.contains(e.target))setOpen(false);};
    const onEsc=e=>{if(e.key==="Escape")setOpen(false);};
    document.addEventListener("mousedown",onDown);
    document.addEventListener("touchstart",onDown);
    document.addEventListener("keydown",onEsc);
    return()=>{
      document.removeEventListener("mousedown",onDown);
      document.removeEventListener("touchstart",onDown);
      document.removeEventListener("keydown",onEsc);
    };
  },[open]);
  return(
    <div ref={wrapRef} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{...ghostBtn,padding:"6px 8px",color:color||t.text,borderRadius:"8px",background:open?t.tag:"transparent",border:`1px solid ${open?t.line:"transparent"}`}} title="More options" aria-label="More options" aria-expanded={open}>
        <DotsIcon/>
      </button>
      {open&&<div style={{position:"absolute",top:"calc(100% + 8px)",right:0,background:"#161b22",border:"1px solid #30363d",borderRadius:"12px",boxShadow:"0 8px 28px rgba(0,0,0,.7)",zIndex:1500,minWidth:"220px",overflow:"hidden"}}>
        {items.map((item,i)=>(
          <button key={i} onClick={()=>{setOpen(false);item.onClick&&item.onClick();}} style={{display:"flex",alignItems:"center",gap:"12px",width:"100%",padding:"13px 16px",background:"transparent",border:"none",borderTop:i===0?"none":"1px solid #30363d",color:item.color||t.text,fontSize:"14px",fontWeight:600,textAlign:"left",cursor:"pointer",fontFamily:ff}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
            <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:"22px",flexShrink:0,color:item.color||t.muted}}>{item.icon}</span>
            <span style={{flex:1}}>{item.label}</span>
          </button>
        ))}
      </div>}
    </div>
  );
}


// ── PERSISTENT OPERATIONS CENTER HOME BUTTON ────────────────────────────────
// The fixed top bar is rendered by the static <a id="op-center-home-btn"> in
// public/index.html, so this React component renders nothing to avoid stacking
// a duplicate bar.
function OpsHomeBtn(){return null;}

function getSubOrderIdFromHash(){
  const h=typeof window!=="undefined"?(window.location.hash||""):"";
  if(h.startsWith("#/sub/")){const id=h.slice(6).split(/[?&#/]/)[0];return id||null;}
  return null;
}

export default function App(){
  const[subOrderId,setSubOrderId]=useState(()=>getSubOrderIdFromHash());
  const online=useOnline();
  useEffect(()=>{
    const onHash=()=>setSubOrderId(getSubOrderIdFromHash());
    window.addEventListener("hashchange",onHash);
    return()=>window.removeEventListener("hashchange",onHash);
  },[]);
  if(subOrderId)return(<><OfflineBanner online={online}/><SubOrderPublicView orderId={subOrderId}/></>);
  return(<><OfflineBanner online={online}/><SkeletonStyles/><AppGate><AppInner/></AppGate></>);
}

// ── Inline attachment renderer for the subcontractor public page (no FileViewer modal). ──
// Images render as full-width imgs; PDFs render every page via PDF.js as scrollable images;
// office files show the same "ask manager to re-upload" message inline.
function SubAttachmentInline({attachment}){
  const url=attachment.url;
  const name=attachment.name||"Attachment";
  const type=getFileType(url,name);
  const ext=((name||"").split(".").pop()||"").toUpperCase();
  const[pdfPages,setPdfPages]=React.useState([]);
  const[pdfLoading,setPdfLoading]=React.useState(false);
  const[pdfError,setPdfError]=React.useState(false);

  React.useEffect(()=>{
    if(type!=="pdf")return;
    let cancelled=false;
    setPdfLoading(true);setPdfPages([]);setPdfError(false);
    const load=async()=>{
      try{
        if(!window.pdfjsLib){
          await new Promise((res,rej)=>{
            const s=document.createElement("script");
            s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";res();};
            s.onerror=rej;document.head.appendChild(s);
          });
        }
        const pdf=await window.pdfjsLib.getDocument(url).promise;
        const pages=[];
        for(let p=1;p<=pdf.numPages;p++){
          const page=await pdf.getPage(p);
          const vp=page.getViewport({scale:2.0});
          const canvas=document.createElement("canvas");
          canvas.width=vp.width;canvas.height=vp.height;
          const ctx=canvas.getContext("2d");
          await page.render({canvasContext:ctx,viewport:vp}).promise;
          pages.push(canvas.toDataURL("image/jpeg",0.92));
        }
        if(!cancelled)setPdfPages(pages);
      }catch(e){console.error("Sub PDF render error:",e);if(!cancelled)setPdfError(true);}
      finally{if(!cancelled)setPdfLoading(false);}
    };
    load();
    return()=>{cancelled=true;};
  },[url,type]);

  const labelStyle={fontSize:"10px",fontWeight:700,letterSpacing:"1.2px",textTransform:"uppercase",color:"#444",marginBottom:"6px"};

  if(type==="image"){
    return(
      <div style={{marginBottom:"14px"}}>
        <div style={labelStyle}>{name}</div>
        <img src={url} alt={name} style={{width:"100%",border:"1px solid #999",display:"block",borderRadius:"4px"}}/>
      </div>
    );
  }
  if(type==="pdf"){
    return(
      <div style={{marginBottom:"14px"}}>
        <div style={labelStyle}>{name} {pdfPages.length>0&&<span style={{color:"#888",fontWeight:600,letterSpacing:"normal",textTransform:"none"}}>· {pdfPages.length} page{pdfPages.length===1?"":"s"}</span>}</div>
        {pdfLoading&&<div style={{padding:"24px",textAlign:"center",border:"1px solid #999",borderRadius:"4px",background:"#fafafa",color:"#666",fontSize:"13px"}}>Loading PDF…</div>}
        {pdfError&&<div style={{padding:"16px",border:"1px solid #999",borderRadius:"4px",background:"#fafafa",color:"#000",fontSize:"13px"}}>Could not render PDF inline. <a href={url} target="_blank" rel="noreferrer" style={{color:"#000"}}>Open PDF</a></div>}
        {!pdfLoading&&!pdfError&&pdfPages.map((src,i)=>(
          <div key={i} style={{marginBottom:"8px"}}>
            {pdfPages.length>1&&<div style={{fontSize:"10px",color:"#888",marginBottom:"4px",fontWeight:600,letterSpacing:"1px"}}>PAGE {i+1} OF {pdfPages.length}</div>}
            <img src={src} alt={`${name} page ${i+1}`} style={{width:"100%",border:"1px solid #999",display:"block",borderRadius:"4px"}}/>
          </div>
        ))}
      </div>
    );
  }
  if(type==="office"){
    return(
      <div style={{marginBottom:"14px",padding:"12px 14px",border:"1px solid #999",borderRadius:"4px",background:"#fafafa"}}>
        <div style={{fontSize:"13px",fontWeight:700,color:"#000",marginBottom:"6px"}}>📋 {name}</div>
        <div style={{fontSize:"12px",color:"#444",lineHeight:1.5}}>This file was uploaded as a {ext||"document"} document. For best viewing, ask your manager to re-upload it as a PDF or image.</div>
      </div>
    );
  }
  return(
    <div style={{marginBottom:"14px",padding:"10px 12px",border:"1px solid #999",borderRadius:"4px",background:"#fff"}}>
      <a href={url} target="_blank" rel="noreferrer" style={{fontSize:"13px",color:"#000",textDecoration:"underline"}}>📎 {name}</a>
    </div>
  );
}

// ── SUBCONTRACTOR PUBLIC ORDER (clean black & white, no login) ───────────────
function SubOrderPublicView({orderId}){
  const[order,setOrder]=useState(null);
  const[loaded,setLoaded]=useState(false);
  const[copied,setCopied]=useState(false);

  useEffect(()=>{
    let off=null;
    const startListen=()=>{
      off=onValue(ref(db,`subOrders/${orderId}`),s=>{
        setOrder(s.val()||null);setLoaded(true);
      },()=>setLoaded(true));
    };
    const u=onAuthStateChanged(auth,user=>{
      if(user){startListen();}
      else{signInAnonymously(auth).catch(e=>console.error("Anon sign in:",e));}
    });
    return()=>{u();if(off)off();};
  },[orderId]);

  const docFf="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
  const url=typeof window!=="undefined"?window.location.href:"";

  const copyLink=async()=>{
    try{await navigator.clipboard.writeText(url);}
    catch{
      const ta=document.createElement("textarea");ta.value=url;document.body.appendChild(ta);
      ta.select();document.execCommand("copy");document.body.removeChild(ta);
    }
    setCopied(true);setTimeout(()=>setCopied(false),1800);
  };
  const downloadPdf=()=>{
    if(!order)return;
    const pp=order.privacy||{};
    const dv=order.doorCode?(order.doorLocation?`${order.doorCode}  (${order.doorLocation})`:order.doorCode):"";
    const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
    const row=(label,value)=>value?`<tr><td style="padding:10px 14px;border-top:1px solid #000;width:36%;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#000;vertical-align:top">${esc(label)}</td><td style="padding:10px 14px;border-top:1px solid #000;font-size:13px;font-weight:600;color:#000;vertical-align:top">${esc(value)}</td></tr>`:"";
    const section=(title,body)=>body?`<div style="border-top:1px solid #000;padding:12px 14px"><div style="font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#000;margin-bottom:6px">${esc(title)}</div><div style="font-size:13px;color:#000;line-height:1.6;white-space:pre-wrap">${esc(body)}</div></div>`:"";
    const isImage=n=>/\.(jpe?g|png|gif|webp|svg|heic|heif|bmp|tiff?)(\?|#|$)/i.test(n||"");
    const isPdfFile=n=>/\.pdf(\?|#|$)/i.test(n||"");
    const atts=order.attachments||[];
    const imgAtts=atts.filter(a=>isImage(a.name||a.url));
    const pdfAtts=atts.filter(a=>isPdfFile(a.name||a.url));
    const otherAtts=atts.filter(a=>!isImage(a.name||a.url)&&!isPdfFile(a.name||a.url));
    const attNotice=atts.length>0?`<div style="border:2px solid #000;padding:10px 14px;margin:14px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#000;text-align:center">⚠ This order has ${atts.length} attachment${atts.length===1?"":"s"} — see pages below</div>`:"";
    const pdfList=pdfAtts.length>0?`<div style="border-top:1px solid #000;padding:12px 14px"><div style="font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#000;margin-bottom:8px">PDF Attachments</div>${pdfAtts.map(a=>`<div style="margin-bottom:10px;padding:10px;border:1px solid #000"><div style="font-size:12px;font-weight:700;color:#000;margin-bottom:4px">PDF Attachment: ${esc(a.name||"PDF")}</div><a href="${esc(a.url)}" style="font-size:11px;color:#000;text-decoration:underline;word-break:break-all">${esc(a.url)}</a><div style="font-size:11px;color:#000;margin-top:4px;font-style:italic">Open this link to view the PDF attachment</div></div>`).join("")}</div>`:"";
    const otherList=otherAtts.length>0?`<div style="border-top:1px solid #000;padding:12px 14px"><div style="font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#000;margin-bottom:8px">Other Attachments</div>${otherAtts.map(a=>`<div style="margin-bottom:6px"><a href="${esc(a.url)}" style="font-size:12px;color:#000;text-decoration:underline">${esc(a.name||a.url)}</a></div>`).join("")}</div>`:"";
    const imgPages=imgAtts.map(a=>`<div style="page-break-before:always;padding:14px"><div style="font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#000;margin-bottom:8px">Attachment: ${esc(a.name||"Image")}</div><img src="${esc(a.url)}" alt="${esc(a.name||"")}" style="width:100%;border:1px solid #000;display:block"/></div>`).join("");
    const w=window.open("","_blank","width=900,height=700");
    if(!w)return;
    w.document.write(`<!DOCTYPE html><html><head><title>Subcontractor Work Order — ${esc(order.jobName||order.subName||"")}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;color:#000}
      .doc{max-width:720px;margin:0 auto;background:#fff;border:1px solid #000}
      a{color:#000}
      @media print{
        body{background:#fff}
        .doc{border:none;max-width:100%}
        @page{margin:0.5in}
      }
    </style>
    </head><body><div class="doc">
      <div style="padding:20px 18px 14px;border-bottom:2px solid #000">
        <div style="font-size:20px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#000">Icon Remodeling Group Inc.</div>
        <div style="font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#000;margin-top:4px">Subcontractor Work Order</div>
      </div>
      ${attNotice}
      <table style="width:100%;border-collapse:collapse">
        ${row("Subcontractor",order.subName)}
        ${row("Date of Work",order.date)}
        ${row("Job",order.jobName)}
        ${pp.customerName?row("Customer",order.customerName):""}
        ${pp.jobAddress?row("Job Address",order.jobAddress):""}
        ${pp.wifiName?row("WiFi Name",order.wifiName):""}
        ${pp.wifiPassword?row("WiFi Password",order.wifiPassword):""}
        ${pp.garageCode?row("Garage Code",order.garageCode):""}
        ${pp.doorCode?row("Door Code",dv):""}
      </table>
      ${section("Scope of Work",order.scope)}
      ${section("Materials to Bring",order.materials)}
      ${section("Special Instructions",order.instructions)}
      ${pdfList}
      ${otherList}
      <div style="padding:14px 18px;border-top:2px solid #000;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#000;text-align:center">Icon Remodeling Group Inc. · Subcontractor Work Order</div>
      ${imgPages}
    </div></body></html>`);
    w.document.close();
    setTimeout(()=>{try{w.focus();w.print();}catch{}},600);
  };
  const mailHref=`mailto:?subject=${encodeURIComponent(`Icon Remodeling Group — Subcontractor Work Order ${order?.jobName||order?.id||""}`.trim())}&body=${encodeURIComponent(`Please find your work order details at the following link: ${url}\n\nIf there are attachments included, you will be notified at the top of the work order page.`)}`;

  if(!loaded)return(
    <div style={{minHeight:"100vh",background:"#fff",color:"#000",fontFamily:docFf,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{fontSize:"14px",color:"#555"}}>Loading…</div>
    </div>
  );
  if(!order)return(
    <div style={{minHeight:"100vh",background:"#fff",color:"#000",fontFamily:docFf,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"24px"}}>
      <div>
        <div style={{fontSize:"22px",fontWeight:900,letterSpacing:"1.5px",textTransform:"uppercase"}}>Icon Remodeling Group Inc.</div>
        <div style={{marginTop:"24px",fontSize:"14px",color:"#444"}}>This work order is unavailable or has been removed.</div>
      </div>
    </div>
  );

  const p=order.privacy||{};
  const Row=({label,value})=>value?(
    <div style={{padding:"11px 22px",borderTop:"1px solid #999"}}>
      <div style={{fontSize:"10px",fontWeight:700,letterSpacing:"1.4px",textTransform:"uppercase",color:"#666",marginBottom:"3px"}}>{label}</div>
      <div style={{fontSize:"14px",fontWeight:600,color:"#000"}}>{value}</div>
    </div>
  ):null;
  const Section=({title,body})=>body?(
    <div style={{borderTop:"1px solid #999",padding:"14px 22px"}}>
      <div style={{fontSize:"10px",fontWeight:700,letterSpacing:"1.4px",textTransform:"uppercase",color:"#666",marginBottom:"6px"}}>{title}</div>
      <div style={{fontSize:"14px",color:"#000",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{body}</div>
    </div>
  ):null;

  const doorValue=order.doorCode?(order.doorLocation?`${order.doorCode}  (${order.doorLocation})`:order.doorCode):"";

  const goAppHome=()=>{window.location.href=window.location.origin;};

  return(
    <div style={{minHeight:"100vh",background:"#f4f4f4",color:"#000",fontFamily:docFf}}>
      <style>{`
        @media print{
          body{background:#fff !important;}
          .no-print{display:none !important;}
          .doc-wrap{box-shadow:none !important;border:none !important;margin:0 !important;max-width:100% !important;}
          @page{margin:0.5in;}
        }
      `}</style>
      <div className="no-print" style={{display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"10px 16px",background:"#fff",borderBottom:"1px solid #999"}}>
        <button onClick={goAppHome} style={{padding:"8px 14px",background:"#fff",color:"#000",border:"1px solid #000",borderRadius:"6px",fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:docFf}}>← Home</button>
      </div>
      <style>{`@media (max-width:560px){.sub-actions{flex-direction:column !important}.sub-actions>*{width:100% !important;flex:1 1 100% !important}}`}</style>
      <div className="no-print sub-actions" style={{display:"flex",justifyContent:"center",flexWrap:"wrap",gap:"10px",padding:"14px 16px",background:"#fff",borderBottom:"1px solid #999"}}>
        <button onClick={copyLink} style={{padding:"12px 18px",background:"#000",color:"#fff",border:"1px solid #000",borderRadius:"6px",fontSize:"14px",fontWeight:700,cursor:"pointer",fontFamily:docFf}}>{copied?"Link Copied!":"Copy Link"}</button>
        <button onClick={downloadPdf} style={{padding:"12px 18px",background:"#000",color:"#fff",border:"1px solid #000",borderRadius:"6px",fontSize:"14px",fontWeight:700,cursor:"pointer",fontFamily:docFf}}>🖨️ Download / Print PDF</button>
        <a href={mailHref} style={{padding:"12px 18px",background:"#fff",color:"#000",border:"1px solid #000",borderRadius:"6px",fontSize:"14px",fontWeight:700,cursor:"pointer",fontFamily:docFf,textDecoration:"none",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>📧 Email this Order</a>
      </div>
      <div className="doc-wrap" style={{maxWidth:"720px",margin:"20px auto 40px",background:"#fff",border:"1px solid #999",boxShadow:"0 0 30px rgba(0,0,0,.1)"}}>
        <div style={{padding:"24px 24px 18px",borderBottom:"2px solid #000"}}>
          <div style={{fontSize:"22px",fontWeight:900,letterSpacing:"1.5px",textTransform:"uppercase",color:"#000"}}>Icon Remodeling Group Inc.</div>
          <div style={{fontSize:"11px",fontWeight:700,letterSpacing:"3px",textTransform:"uppercase",color:"#444",marginTop:"5px"}}>Subcontractor Work Order</div>
        </div>
        <Row label="Subcontractor" value={order.subName}/>
        <Row label="Date of Work" value={order.date}/>
        <Row label="Job" value={order.jobName}/>
        {p.customerName&&<Row label="Customer" value={order.customerName}/>}
        {p.jobAddress&&<Row label="Job Address" value={order.jobAddress}/>}
        {p.wifiName&&<Row label="WiFi Name" value={order.wifiName}/>}
        {p.wifiPassword&&<Row label="WiFi Password" value={order.wifiPassword}/>}
        {p.garageCode&&<Row label="Garage Code" value={order.garageCode}/>}
        {p.doorCode&&<Row label="Door Code" value={doorValue}/>}
        <Section title="Scope of Work" body={order.scope}/>
        <Section title="Materials to Bring" body={order.materials}/>
        <Section title="Special Instructions" body={order.instructions}/>
        {(order.attachments||[]).length>0&&(
          <div style={{borderTop:"1px solid #999",padding:"14px 22px"}}>
            <div style={{fontSize:"10px",fontWeight:700,letterSpacing:"1.4px",textTransform:"uppercase",color:"#666",marginBottom:"10px"}}>Attachments ({(order.attachments||[]).length})</div>
            {(order.attachments||[]).map((a,i)=>(
              <SubAttachmentInline key={i} attachment={a}/>
            ))}
          </div>
        )}
        <div style={{padding:"16px 24px",borderTop:"2px solid #000",fontSize:"10px",letterSpacing:"1.5px",textTransform:"uppercase",color:"#444",textAlign:"center"}}>
          Icon Remodeling Group Inc. · Subcontractor Work Order
        </div>
      </div>
    </div>
  );
}

// ── SUBCONTRACTOR ORDERS (manager side, dark palette) ───────────────────────
const subT={bg:"#0d1117",card:"#161b22",line:"#30363d",red:"#E8192C",text:"#e6edf3",muted:"#8b949e"};
const subInputStyle={width:"100%",padding:"13px 15px",background:"#0d1117",border:`1.5px solid ${subT.line}`,borderRadius:"10px",color:subT.text,fontSize:"16px",fontFamily:ff,outline:"none",boxSizing:"border-box"};
const subLabelStyle={display:"block",fontSize:"11px",fontWeight:700,color:subT.muted,textTransform:"uppercase",letterSpacing:"1.4px",marginBottom:"8px"};

const PRIVACY_FIELDS=[
  ["customerName","Customer Name"],
  ["jobAddress","Job Address"],
  ["wifiName","WiFi Name"],
  ["wifiPassword","WiFi Password"],
  ["garageCode","Garage Code"],
  ["doorCode","Door Code"],
];

function SubOrderManager({onBack,onHome,activeJobs,showToast}){
  const today=new Date().toISOString().split("T")[0];
  const defaultExpiry=(()=>{const d=new Date();d.setDate(d.getDate()+7);return d.toISOString().split("T")[0];})();
  const empty={subName:"",date:today,jobIndex:"",scope:"",materials:"",instructions:"",attachments:[],expiresAt:defaultExpiry,
    privacy:{customerName:false,jobAddress:false,wifiName:false,wifiPassword:false,garageCode:false,doorCode:false}};
  const[subOrders,setSubOrders]=useState({});
  const[loaded,setLoaded]=useState(false);
  const[showForm,setShowForm]=useState(false);
  const[uploading,setUploading]=useState(false);
  const[form,setForm]=useState(empty);
  const[copiedId,setCopiedId]=useState(null);

  useEffect(()=>{
    const u=onValue(ref(db,"subOrders"),s=>{setSubOrders(s.val()||{});setLoaded(true);},()=>setLoaded(true));
    return()=>u();
  },[]);

  const togglePriv=k=>setForm(f=>({...f,privacy:{...f.privacy,[k]:!f.privacy[k]}}));
  const upload=async e=>{
    const files=Array.from(e.target.files);if(!files.length)return;
    setUploading(true);
    const atts=[...(form.attachments||[])];
    for(const f of files){
      try{
        const fn=`${Date.now()}_${f.name}`;
        const fr=storageRef(storage,`suborders/${fn}`);
        await uploadBytes(fr,f);
        const url=await getDownloadURL(fr);
        atts.push({name:f.name,url,uploadedAt:new Date().toISOString()});
      }catch(err){console.error(err);showToast("Upload failed");}
    }
    setForm(f=>({...f,attachments:atts}));setUploading(false);
    showToast(`${files.length} file(s) uploaded`);e.target.value="";
  };
  const removeAtt=i=>setForm(f=>({...f,attachments:(f.attachments||[]).filter((_,x)=>x!==i)}));

  const save=()=>{
    if(!form.subName.trim()){showToast("Subcontractor name required");return;}
    if(form.jobIndex===""){showToast("Select an active job");return;}
    const job=(activeJobs||[])[Number(form.jobIndex)];
    if(!job){showToast("Invalid job");return;}
    const id=`${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const order={
      id,createdAt:new Date().toISOString(),
      subName:form.subName.trim(),date:form.date,
      expiresAt:form.expiresAt||defaultExpiry,
      jobName:job.name||"",
      customerName:job.customerName||"",
      jobAddress:job.address||"",
      wifiName:job.wifiName||"",
      wifiPassword:job.wifiPassword||"",
      garageCode:job.garageCode||"",
      doorCode:job.doorCode||"",
      doorLocation:job.doorLocation||"",
      scope:form.scope,materials:form.materials,instructions:form.instructions,
      attachments:form.attachments||[],
      privacy:form.privacy,
    };
    saveToFB(`subOrders/${id}`,order);
    setForm(empty);setShowForm(false);showToast("Subcontractor order created");
  };

  // Filter recent orders by expiration date (legacy orders without expiresAt fall back to 7 days from createdAt)
  const recent=Object.values(subOrders||{}).filter(o=>{
    if(!o?.createdAt)return false;
    let exp=o.expiresAt;
    if(!exp){
      const d=new Date(o.createdAt);d.setDate(d.getDate()+7);
      exp=d.toISOString().split("T")[0];
    }
    return new Date(exp+"T23:59:59")>=new Date();
  }).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));

  const linkFor=id=>`${window.location.origin}/#/sub/${id}`;
  const copyLink=async id=>{
    const link=linkFor(id);
    try{await navigator.clipboard.writeText(link);}
    catch{
      const ta=document.createElement("textarea");ta.value=link;document.body.appendChild(ta);
      ta.select();document.execCommand("copy");document.body.removeChild(ta);
    }
    setCopiedId(id);showToast("Link copied");
    setTimeout(()=>setCopiedId(c=>c===id?null:c),1800);
  };
  const deleteOrder=id=>{
    if(!window.confirm("Delete this order? The public link will stop working."))return;
    set(ref(db,`subOrders/${id}`),null).catch(e=>console.error(e));
    showToast("Deleted");
  };

  return(
    <div style={{minHeight:"100vh",background:subT.bg,fontFamily:ff,color:subT.text}}>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${subT.line}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:subT.card}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",minWidth:0}}>
          <button onClick={onBack} style={{...ghostBtn,padding:"6px 10px",color:subT.text,display:"inline-flex",alignItems:"center",gap:"4px",fontSize:"13px",fontWeight:600}}><BackIcon/>Previous Page</button>
          <div style={{minWidth:0}}>
            <div style={{fontSize:"15px",fontWeight:700,color:subT.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Subcontractor Orders</div>
            <div style={{fontSize:"11px",color:subT.muted,whiteSpace:"nowrap"}}>{recent.length} active in last 7 days</div>
          </div>
        </div>
        <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
          {!showForm&&<button onClick={()=>{setForm(empty);setShowForm(true);}} style={{...baseBtn,background:subT.red,color:"#fff",padding:"8px 14px",fontSize:"13px"}}><PlusIcon/> New</button>}
          <button onClick={onHome} style={{...ghostBtn,padding:"6px",color:subT.muted}} title="Home"><HomeIcon/></button>
        </div>
      </div>

      <div style={{padding:"20px",maxWidth:"720px",margin:"0 auto",paddingBottom:"100px",boxSizing:"border-box"}}>
        {showForm?(
          <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
            <h2 style={{fontSize:"19px",margin:"0 0 4px",fontWeight:700,color:subT.text}}>New Subcontractor Order</h2>
            <div><label style={subLabelStyle}>Subcontractor / Company</label><input value={form.subName} onChange={e=>setForm({...form,subName:e.target.value})} placeholder="Subcontractor or company name" style={subInputStyle}/></div>
            <div><label style={subLabelStyle}>Date of Work</label><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={subInputStyle}/></div>
            <div>
              <label style={subLabelStyle}>Link Expires On</label>
              <MiniCalendar value={form.expiresAt} onChange={v=>setForm({...form,expiresAt:v})} minDate={today} theme="dark"/>
              <div style={{fontSize:"11px",color:subT.muted,marginTop:"5px"}}>The public link always works — expiration only controls visibility in this list. Default: 7 days from today.</div>
            </div>
            <div>
              <label style={subLabelStyle}>Active Job</label>
              <select value={form.jobIndex} onChange={e=>setForm({...form,jobIndex:e.target.value})} style={{...subInputStyle,appearance:"none",cursor:"pointer"}}>
                <option value="">— Select an active job —</option>
                {(activeJobs||[]).map((j,i)=><option key={i} value={i}>{j.name}{j.customerName?` · ${j.customerName}`:""}</option>)}
              </select>
            </div>
            <div><label style={subLabelStyle}>Scope of Work</label><BulletTextarea value={form.scope} onChange={e=>setForm({...form,scope:e.target.value})} placeholder="What the sub will do… (Enter for bullets)" style={subInputStyle}/></div>
            <div><label style={subLabelStyle}>Materials to Bring</label><BulletTextarea value={form.materials} onChange={e=>setForm({...form,materials:e.target.value})} placeholder="Materials… (Enter for bullets)" style={subInputStyle}/></div>
            <div><label style={subLabelStyle}>Special Instructions</label><BulletTextarea value={form.instructions} onChange={e=>setForm({...form,instructions:e.target.value})} placeholder="Notes, access, timing… (Enter for bullets)" style={subInputStyle}/></div>

            <div>
              <label style={subLabelStyle}>Attachments (PDF / drawings)</label>
              <input type="file" multiple style={{display:"none"}} id="suborder-file" onChange={upload}/>
              <button onClick={()=>document.getElementById("suborder-file")?.click()} disabled={uploading} style={{...baseBtn,background:subT.card,border:`1px solid ${subT.line}`,color:subT.text,padding:"11px 16px",fontSize:"14px",width:"100%"}}><PaperclipIcon/> {uploading?"Uploading…":"Add Attachment"}</button>
              {(form.attachments||[]).length>0&&<div style={{marginTop:"8px",display:"flex",flexDirection:"column",gap:"6px"}}>
                {form.attachments.map((a,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:subT.card,border:`1px solid ${subT.line}`,padding:"8px 12px",borderRadius:"8px"}}>
                    <span style={{fontSize:"13px",color:subT.text,display:"inline-flex",alignItems:"center",gap:"6px"}}><PaperclipIcon/> {a.name}</span>
                    <button onClick={()=>removeAtt(i)} style={{...ghostBtn,padding:"4px",color:subT.red}}><TrashIcon/></button>
                  </div>
                ))}
              </div>}
            </div>

            <div style={{background:subT.card,border:`1px solid ${subT.line}`,borderRadius:"12px",padding:"16px"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:subT.muted,textTransform:"uppercase",letterSpacing:"1.4px",marginBottom:"4px"}}>Privacy — Show on Sub's Document</div>
              <div style={{fontSize:"12px",color:subT.muted,marginBottom:"6px"}}>All OFF by default. Toggle ON only what the sub should see.</div>
              {PRIVACY_FIELDS.map(([k,label])=>{
                const on=!!form.privacy[k];
                return(
                  <div key={k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderTop:`1px solid ${subT.line}`}}>
                    <span style={{fontSize:"14px",color:subT.text}}>{label}</span>
                    <button type="button" onClick={()=>togglePriv(k)} style={{width:"44px",height:"24px",borderRadius:"14px",background:on?subT.red:subT.line,border:"none",position:"relative",cursor:"pointer",padding:0}}>
                      <span style={{position:"absolute",top:"2px",left:on?"22px":"2px",width:"20px",height:"20px",background:"#fff",borderRadius:"50%",transition:"left .15s"}}/>
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{display:"flex",gap:"10px"}}>
              <button onClick={()=>setShowForm(false)} style={{...baseBtn,flex:1,background:subT.card,border:`1px solid ${subT.line}`,color:subT.muted,padding:"14px"}}>Cancel</button>
              <button onClick={save} style={{...baseBtn,flex:2,background:subT.red,color:"#fff",padding:"14px",fontWeight:700,borderRadius:"10px",justifyContent:"center"}}>Create Order</button>
            </div>
          </div>
        ):(
          <>
            <div style={{fontSize:"17px",fontWeight:700,color:subT.text,marginBottom:"4px"}}>Recent Subcontractor Orders</div>
            <div style={{fontSize:"12px",color:subT.muted,marginBottom:"14px"}}>Showing orders from the last 7 days. Older orders are hidden but their public links keep working.</div>
            {!loaded?(
              <div style={{textAlign:"center",padding:"48px",color:subT.muted}}>Loading…</div>
            ):recent.length===0?(
              <div style={{textAlign:"center",padding:"48px",color:subT.muted}}>
                <div>No subcontractor orders yet</div>
                <div style={{fontSize:"12px",marginTop:"5px"}}>Tap New to create one</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                {recent.map(o=>{
                  const sharedCount=Object.values(o.privacy||{}).filter(Boolean).length;
                  const exp=o.expiresAt||(()=>{const d=new Date(o.createdAt||Date.now());d.setDate(d.getDate()+7);return d.toISOString().split("T")[0];})();
                  const hoursToExp=(new Date(exp+"T23:59:59")-new Date())/3600000;
                  const expiringSoon=hoursToExp<=24&&hoursToExp>0;
                  return(
                    <div key={o.id} style={{background:subT.card,border:`1px solid ${subT.line}`,borderRadius:"12px",padding:"15px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"10px"}}>
                        <div style={{minWidth:0,flex:1}}>
                          <div style={{fontSize:"15px",fontWeight:700,color:subT.text,marginBottom:"3px"}}>{o.subName}</div>
                          <div style={{fontSize:"12px",color:subT.muted}}>{o.date} · {o.jobName||"—"}</div>
                          <div style={{fontSize:"11px",color:expiringSoon?"#F59E0B":subT.muted,marginTop:"3px",fontWeight:expiringSoon?700:500}}>
                            {expiringSoon?"⚠ Expires within 24h · ":"Expires "}{exp}
                          </div>
                        </div>
                        <span style={{fontSize:"10px",background:"rgba(232,25,44,0.15)",color:subT.red,padding:"3px 10px",borderRadius:"20px",fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",whiteSpace:"nowrap"}}>{sharedCount} field{sharedCount===1?"":"s"} shared</span>
                      </div>
                      <div style={{fontSize:"11px",color:subT.muted,marginTop:"8px",wordBreak:"break-all"}}>{linkFor(o.id)}</div>
                      <div style={{display:"flex",gap:"8px",marginTop:"12px",flexWrap:"wrap"}}>
                        <button onClick={()=>copyLink(o.id)} style={{...baseBtn,flex:"1 1 120px",background:subT.red,color:"#fff",padding:"9px 12px",fontSize:"12px",borderRadius:"8px",fontWeight:700}}>{copiedId===o.id?"Copied!":"Copy Link"}</button>
                        <a href={`#/sub/${o.id}`} target="_blank" rel="noreferrer" style={{...baseBtn,flex:"1 1 80px",background:subT.bg,border:`1px solid ${subT.line}`,color:subT.text,padding:"9px 12px",fontSize:"12px",borderRadius:"8px",fontWeight:700,textDecoration:"none"}}>Open</a>
                        <button onClick={()=>deleteOrder(o.id)} style={{...baseBtn,background:subT.bg,border:`1px solid ${subT.line}`,color:subT.red,padding:"9px 12px",fontSize:"12px",borderRadius:"8px",fontWeight:700}}><TrashIcon/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AppInner(){
  const[mode,setMode]=useState(null);
  const[orders,ordersL]=useFB("orders",[]);
  const[fieldOrders,fieldL]=useFB("fieldOrders",[]);
  const[crews,crewsL]=useFB("crews",DEFAULT_CREWS);
  const[managerPin]=useFB("settings/managerPin",DEFAULT_PIN);
  const[crewPin]=useFB("settings/crewPin",DEFAULT_CREW_PIN);
  const[fieldNotes,fieldNotesL]=useFB("fieldNotes",[]);
  const[standaloneFiles,standaloneFilesL]=useFB("standaloneFiles",[]);
  const[lockboxCodes,lockboxL]=useFB("lockboxCodes",[]);
  const[activeJobs,activeJobsL]=useFB("activeJobs",[]);
  const[lastSeen,setLastSeen]=useState(()=>{try{return JSON.parse(localStorage.getItem("wo-seen"))||{};}catch{return{};}});
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
  const[newCrewPin,setNewCrewPin]=useState("");
  const[editingFieldOrder,setEditingFieldOrder]=useState(null);
  const[showFieldForm,setShowFieldForm]=useState(false);
  const[noteText,setNoteText]=useState("");
  const[noteAtts,setNoteAtts]=useState([]);
  const[selectedJob,setSelectedJob]=useState("");
  const[selectedLockbox,setSelectedLockbox]=useState(null);
  const[lockboxForm,setLockboxForm]=useState({jobName:"",jobLocation:"",keyBoxLocation:"",keyBoxCode:"",linkedJobIndex:""});
  const[editingLockbox,setEditingLockbox]=useState(null);
  const[showLockboxForm,setShowLockboxForm]=useState(false);
  const[editingActiveJob,setEditingActiveJob]=useState(null);
  const[showAddJob,setShowAddJob]=useState(false);
  const[jobMenu,setJobMenu]=useState(null);
  const[deleteJobConfirm,setDeleteJobConfirm]=useState(null);
  const[fileViewer,setFileViewer]=useState(null);
  const[docView,setDocView]=useState(null);
  const[newJobName,setNewJobName]=useState("");
  const[newJobAddress,setNewJobAddress]=useState("");
  const[newJobWifiName,setNewJobWifiName]=useState("");
  const[newJobWifiPass,setNewJobWifiPass]=useState("");
  const[newJobCustomerName,setNewJobCustomerName]=useState("");
  const[newJobTreadName,setNewJobTreadName]=useState("");
  const[keyModal,setKeyModal]=useState(null);
  const[wifiModal,setWifiModal]=useState(null);
  const[doorModal,setDoorModal]=useState(null);
  const[newJobGarageCode,setNewJobGarageCode]=useState("");
  const[newJobDoorType,setNewJobDoorType]=useState("");
  const[newJobDoorLocation,setNewJobDoorLocation]=useState("");
  const[newJobDoorCode,setNewJobDoorCode]=useState("");
  const[recurringTemplates,setRecurringTemplates]=useState({});
  const[mgrTab,setMgrTab]=useState("today"); // today | recurring | history
  const[mgrSearch,setMgrSearch]=useState("");
  const[mgrFilter,setMgrFilter]=useState("today"); // today | week | all | crew:<name>
  const[archiveSearch,setArchiveSearch]=useState("");
  const[activityEntries,setActivityEntries]=useState([]);
  const[dailySummaries,setDailySummaries]=useState({});
  const[materialsRequests,setMaterialsRequests]=useState({});
  const[materialsDetail,setMaterialsDetail]=useState(null);
  const[showMaterialsForm,setShowMaterialsForm]=useState(false);
  const[aiSettings,setAiSettings]=useState({aiDescriptionGenerator:false,aiMaterialsSuggest:false,aiVoiceToOrder:false,aiMaterials:true});
  const[aiDescDialog,setAiDescDialog]=useState(null); // {jobIdx}
  const[aiMatsDialog,setAiMatsDialog]=useState(null); // {jobIdx, jobDescription}
  const[aiVoiceDialog,setAiVoiceDialog]=useState(false);
  const[expandedSummaries,setExpandedSummaries]=useState({});
  const[summaryCardOpen,setSummaryCardOpen]=useState(false);
  const[memberPhones,setMemberPhones]=useState({});
  const fileRef=useRef(null);const fieldFileRef=useRef(null);const noteFileRef=useRef(null);const cameraRef=useRef(null);const filesUploadRef=useRef(null);

  // Subscribe to member phone numbers (for auto-SMS)
  useEffect(()=>{
    const u=onValue(ref(db,"memberPhones"),s=>setMemberPhones(s.val()||{}));
    return()=>u();
  },[]);

  // Subscribe to recurring templates / activity log / daily summaries / materials
  useEffect(()=>{
    const u1=onValue(ref(db,"recurringTemplates"),s=>setRecurringTemplates(s.val()||{}));
    const u2=onValue(ref(db,"activityLog"),s=>{
      const v=s.val()||{};
      const arr=Object.values(v).sort((a,b)=>(b.ts||"").localeCompare(a.ts||""));
      setActivityEntries(arr);
    });
    const u3=onValue(ref(db,"dailySummaries"),s=>setDailySummaries(s.val()||{}));
    const u4=onValue(ref(db,"materialsRequests"),s=>setMaterialsRequests(s.val()||{}));
    const u5=onValue(ref(db,"settings/ai"),s=>{const v=s.val();if(v&&typeof v==="object")setAiSettings(prev=>({...prev,...v}));});
    const u6=onValue(ref(db,"settings/aiMaterials"),s=>{const v=s.val();if(v!==null&&v!==undefined)setAiSettings(prev=>({...prev,aiMaterials:v}));});
    return()=>{u1();u2();u3();u4();u5();u6();};
  },[]);

  const loading=!ordersL||!crewsL||!fieldL||!fieldNotesL||!standaloneFilesL||!lockboxL||!activeJobsL;
  const showToast=useCallback(msg=>{setToast(msg);setTimeout(()=>setToast(null),2200);},[]);

  // Backfill missing reference IDs once orders are loaded
  useEffect(()=>{
    if(!ordersL||!orders||orders.length===0)return;
    let changed=false;
    const next=orders.map(o=>{
      if(o&&!o.referenceId){changed=true;return{...o,referenceId:generateReferenceId(o)};}
      return o;
    });
    if(changed)saveToFB("orders",next);
  },[ordersL]);

  // First-time manager-permission prompt for notifications
  const askedPermRef=useRef(false);
  useEffect(()=>{
    if(!managerAuth||askedPermRef.current)return;
    askedPermRef.current=true;
    if(localStorage.getItem("wo-notif-asked")==="1")return;
    localStorage.setItem("wo-notif-asked","1");
    requestPermissionAndRegisterToken().then(token=>{
      if(token)showToast("Notifications enabled");
    });
  },[managerAuth,showToast]);

  // Generate yesterday's daily summary on first manager open of the day
  const ranSummaryRef=useRef(false);
  useEffect(()=>{
    if(!managerAuth||ranSummaryRef.current)return;
    if(!ordersL||!fieldNotesL)return;
    ranSummaryRef.current=true;
    const yesterday=(()=>{const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().split("T")[0];})();
    if(dailySummaries[yesterday])return;
    const yOrders=(orders||[]).filter(o=>o.date===yesterday);
    const yField=(fieldOrders||[]).filter(o=>o.date===yesterday);
    const yNotes=(fieldNotes||[]).filter(n=>(n.submittedAt||"").startsWith(yesterday));
    const yMats=Object.values(materialsRequests||{}).filter(m=>(m.submittedAt||"").startsWith(yesterday));
    const crews=new Set(yOrders.map(o=>o.crewName).filter(Boolean));
    const total=yOrders.length+yField.length;
    if(total===0&&yNotes.length===0&&yMats.length===0)return;
    const summary={
      date:yesterday,
      ordersCount:total,
      crewCount:crews.size,
      fieldNotesCount:yNotes.length,
      materialsCount:yMats.length,
      text:`${total} order${total===1?"":"s"} completed across ${crews.size} crew${crews.size===1?"":"s"}. ${yNotes.length} field note${yNotes.length===1?"":"s"} submitted. ${yMats.length===0?"No materials requests.":`${yMats.length} materials request${yMats.length===1?"":"s"}.`}`,
      generatedAt:new Date().toISOString()
    };
    saveToFB(`dailySummaries/${yesterday}`,summary);
    logActivity({type:"summary",who:"System",text:`Daily summary for ${yesterday}: ${summary.text}`});
    // Trim summaries older than 30 days
    const cutoff=(()=>{const d=new Date();d.setDate(d.getDate()-30);return d.toISOString().split("T")[0];})();
    Object.keys(dailySummaries||{}).forEach(k=>{if(k<cutoff)saveToFB(`dailySummaries/${k}`,null);});
  },[managerAuth,ordersL,fieldNotesL,dailySummaries,orders,fieldOrders,fieldNotes,materialsRequests]);

  // Auto-generate due recurring orders when manager view opens
  const ranAutoGenRef=useRef(false);
  useEffect(()=>{
    if(mode!=="manager"||!managerAuth)return;
    if(ranAutoGenRef.current)return;
    if(!ordersL)return;
    const due=dueTemplates(recurringTemplates,recurringTodayStr());
    if(due.length===0){ranAutoGenRef.current=true;return;}
    let next=[...orders];
    const now=new Date().toISOString();
    const updates={};
    let count=0;
    due.forEach(({id,tpl})=>{
      const dateToUse=tpl.nextScheduledDate||recurringTodayStr();
      const newOrder=orderFromTemplate({...tpl,id},dateToUse,generateReferenceId);
      newOrder.lastModified=now;
      next.push(newOrder);
      count++;
      const nd=nextDate(dateToUse,tpl.recurring?.frequency);
      const stoppedByUntil=tpl.recurring?.until&&nd&&nd>tpl.recurring.until;
      updates[`recurringTemplates/${id}`]={...tpl,id,lastGeneratedDate:dateToUse,nextScheduledDate:stoppedByUntil?null:nd,stopped:!!stoppedByUntil,lastModified:now};
      logActivity({type:"recurring_generated",who:"System",text:`Auto-generated ${newOrder.referenceId} from recurring template`,refId:newOrder.referenceId});
    });
    if(count>0){
      saveToFB("orders",next);
      Object.entries(updates).forEach(([p,v])=>saveToFB(p,v));
      showToast(`Auto-generated ${count} recurring order${count===1?"":"s"}`);
    }
    ranAutoGenRef.current=true;
  },[mode,managerAuth,ordersL,recurringTemplates]);
  const goHome=()=>{setMode(null);setShowForm(false);setShowFieldForm(false);setEditingOrder(null);setEditingFieldOrder(null);setManageCrews(false);setShowArchive(false);setShowPinSettings(false);setSelectedLockbox(null);setShowLockboxForm(false);setEditingLockbox(null);setEditingActiveJob(null);setShowAddJob(false);setJobMenu(null);setDeleteJobConfirm(null);setNewJobName("");setNewJobAddress("");setNewJobWifiName("");setNewJobWifiPass("");setNewJobGarageCode("");setNewJobDoorType("");setNewJobDoorLocation("");setNewJobDoorCode("");setNewJobCustomerName("");setNewJobTreadName("");setFileViewer(null);setDocView(null);setShowMaterialsForm(false);setMaterialsDetail(null);};
  const today=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const markSeen=(section)=>{const n={...lastSeen,[section]:new Date().toISOString()};setLastSeen(n);try{localStorage.setItem("wo-seen",JSON.stringify(n));}catch{}};
  useEffect(()=>{if(mode)markSeen(mode);},[mode]);
  const hasUpdate=(section,items)=>{const ls=lastSeen[section]||"";return(items||[]).some(o=>o.lastModified&&o.lastModified>ls);};
  const crewUpdates=hasUpdate("crew",orders);
  const fieldUpdates=hasUpdate("fieldops",fieldOrders);
  const lockboxUpdates=hasUpdate("lockbox",lockboxCodes);
  // Unread = activity entries newer than the manager's last view of the History tab.
  const lastSeenManager=lastSeen.managerHistory||"";
  const unreadActivity=activityEntries.filter(e=>e.ts>lastSeenManager&&["materials_request","field_note","order_viewed","recurring_generated"].includes(e.type)).length;
  const managerUpdates=crewUpdates||unreadActivity>0;

  const handleUpload=async(e,fd,setFd)=>{
    const files=Array.from(e.target.files);if(!files.length)return;setUploading(true);
    const atts=[...(fd.attachments||[])];
    for(const f of files){
      const dn=window.prompt("Name this attachment:",f.name.replace(/\.[^.]+$/,""))||f.name;
      const result=await processFileForUpload(f,showToast);
      if(result.warn)showToast(result.warn);
      try{
        if(result.multiPage&&result.files){
          for(let pi=0;pi<result.files.length;pi++){
            const pf=result.files[pi];
            const label=result.files.length>1?`${dn} — Page ${pi+1}`:dn;
            const fn=`${Date.now()}_${pf.name}`;const fr=storageRef(storage,`attachments/${fn}`);
            await uploadBytes(fr,pf);const url=await getDownloadURL(fr);
            atts.push({name:label,originalName:f.name,url,uploadedAt:new Date().toISOString(),converted:true});
          }
        } else {
          const uf=result.file;const fn=`${Date.now()}_${uf.name}`;
          const fr=storageRef(storage,`attachments/${fn}`);
          await uploadBytes(fr,uf);const url=await getDownloadURL(fr);
          atts.push({name:dn,originalName:f.name,url,uploadedAt:new Date().toISOString(),converted:!!result.wasConverted});
        }
      }catch(err){showToast("Upload failed");}
    }
    setFd({...fd,attachments:atts});setUploading(false);showToast(`${files.length} file(s) uploaded`);e.target.value="";
  };
  // Open the native SMS app for each assigned member that has a phone number stored.
  // Returns the number of SMS links triggered (0 = silent skip per spec).
  const triggerCrewSms=useCallback((order)=>{
    const members=order.members||[];
    const jobs=getJobsForOrder(order);
    const smsDate=order.date
      ?new Date(order.date+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric"})
      :"today";
    const recipients=members
      .map(name=>({name,phone:String(memberPhones[name]||"").replace(/\D/g,"")}))
      .filter(r=>r.phone.length>=10);
    recipients.forEach((r,i)=>{
      setTimeout(()=>{
        let message;
        if(jobs.length<=1){
          const address=jobs[0]?.jobAddress||"see app";
          message=`Icon Remodeling Group: Hi ${r.name}, you have a new work order for ${smsDate}. Job: ${address}. Open your assignments at icon-work-orders.vercel.app`;
        } else {
          const lines=jobs.map((j,idx)=>`J${idx+1}: ${j.jobAddress||"see app"}`).join("\n");
          message=`Icon Remodeling Group: Hi ${r.name}, you have ${jobs.length} jobs scheduled for ${smsDate}:\n${lines}\nOpen your assignments at icon-work-orders.vercel.app`;
        }
        const link=`sms:${r.phone}&body=${encodeURIComponent(message)}`;
        const a=document.createElement("a");
        a.href=link;a.style.display="none";
        document.body.appendChild(a);
        a.click();
        setTimeout(()=>{try{document.body.removeChild(a);}catch{}},200);
      },i*1500);
    });
    return recipients.length;
  },[memberPhones]);

  const saveCrew=()=>{
    if(!formData.crewName){showToast("Crew required");return;}
    const firstJob=formData.jobs?.[0];
    if(!firstJob?.jobAddress){showToast("Job 1 address required");return;}
    const now=new Date().toISOString();
    const d={...formData,lastModified:now};
    if(!d.referenceId)d.referenceId=generateReferenceId(d);
    const wasEditing=editingOrder!==null;
    let u;
    if(wasEditing){u=orders.map((o,i)=>i===editingOrder?d:o);}
    else{u=[...orders,d];}
    saveToFB("orders",u);

    // Recurring → store/update the template
    if(d.recurring?.enabled){
      const tplId=d.recurringTemplateId||`tpl_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      const tpl={
        id:tplId,
        crewName:d.crewName,
        members:d.members||[],
        jobs:d.jobs||[],
        recurring:{frequency:d.recurring.frequency,until:d.recurring.until||""},
        nextScheduledDate:nextDate(d.date,d.recurring.frequency),
        lastGeneratedDate:d.date,
        lastModified:now,
        stopped:false,
      };
      saveToFB(`recurringTemplates/${tplId}`,tpl);
      logActivity({type:"order_created",who:"Manager",text:`Work Order ${d.referenceId} created (recurring ${d.recurring.frequency})`,refId:d.referenceId});
    } else {
      logActivity({type:"order_created",who:"Manager",text:`Work Order ${d.referenceId} created`,refId:d.referenceId});
    }
    setShowForm(false);setEditingOrder(null);setFormData({...emptyCrewOrder});

    // Auto SMS notification (silent skip if no members have phone numbers)
    const smsCount=triggerCrewSms(d);
    if(smsCount===0){
      showToast(wasEditing?"Updated":"Work order created");
    } else {
      showToast(`Work order saved — notifying ${smsCount} crew member${smsCount===1?"":"s"}`);
    }
  };
  const deleteCrew=i=>{saveToFB("orders",orders.filter((_,x)=>x!==i));setDeleteConfirm(null);showToast("Deleted");};
  const addMember=(crew)=>{if(!newMemberName.trim())return;saveToFB("crews",{...crews,[crew]:[...(crews[crew]||[]),newMemberName.trim()]});setNewMemberName("");showToast("Added");};
  const removeMember=(crew,i)=>{saveToFB("crews",{...crews,[crew]:crews[crew].filter((_,x)=>x!==i)});showToast("Removed");};
  const toggleMember=n=>{setFormData(p=>({...p,members:p.members.includes(n)?p.members.filter(x=>x!==n):[...p.members,n]}));};
  const saveField=()=>{const now=new Date().toISOString();const d={...fieldFormData,lastModified:now};let u;if(editingFieldOrder!==null){u=fieldOrders.map((o,i)=>i===editingFieldOrder?d:o);}else{u=[...fieldOrders,d];}saveToFB("fieldOrders",u);setShowFieldForm(false);setEditingFieldOrder(null);setFieldFormData({...emptyFieldOrder});showToast(editingFieldOrder!==null?"Updated":"Field order created");};
  const deleteField=i=>{saveToFB("fieldOrders",fieldOrders.filter((_,x)=>x!==i));setDeleteConfirm(null);showToast("Deleted");};
  const toggleFieldMember=n=>{setFieldFormData(p=>({...p,staffMember:p.staffMember.includes(n)?p.staffMember.filter(x=>x!==n):[...p.staffMember,n]}));};
  const addFieldNote=async(note)=>{const now=new Date().toISOString();const n={...note,submittedAt:now,lastModified:now};const u=[...(fieldNotes||[]),n];saveToFB("fieldNotes",u);logActivity({type:"field_note",who:n.submittedBy||"Crew",text:`Field note submitted${n.jobRef?` for ${n.jobRef}`:""}${n.notes?": "+(n.notes.length>60?n.notes.slice(0,60)+"…":n.notes):""}`});localNotify("New field note",n.jobRef||"Crew submitted a field note");showToast("Field note saved");};

  const handlePrint=(order)=>{
    const jobs=getJobsForOrder(order);
    const members=(order.members||order.staffMember||[]).join(", ");
    const isField=!!(order.staffMember);

    const renderBulletHtml=(text)=>{
      if(!text)return"";
      return text.split("\n").map(l=>`<div style="margin-bottom:3px">${l}</div>`).join("");
    };

    const jobHtml=(job,jobIdx,showHeader)=>{
      let h="";
      if(showHeader){
        h+=`<div style="background:#0077C8;padding:9px 18px;display:flex;align-items:center;gap:10px;border-top:2px solid #D6D9DE;margin-top:16px">
          <div style="width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#fff">${jobIdx+1}</div>
          <div style="font-size:12px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:1px">Job ${jobIdx+1}${job.customerName?" — "+job.customerName:""}</div>
        </div>`;
      }
      // Info grid
      h+=`<table style="width:100%;border-collapse:collapse;font-size:13px">`;
      if(job.customerName||job.customerPhone){
        h+=`<tr>`;
        if(job.customerName)h+=`<td style="padding:10px 14px;border:1px solid #D6D9DE;width:50%"><div style="font-size:9px;font-weight:700;color:#5F6670;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Customer</div><div style="font-weight:600;color:#1F2329">${job.customerName||""}</div></td>`;
        if(job.customerPhone)h+=`<td style="padding:10px 14px;border:1px solid #D6D9DE"><div style="font-size:9px;font-weight:700;color:#5F6670;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Phone</div><div style="font-weight:600;color:#1F2329">${job.customerPhone||""}</div></td>`;
        if(job.customerName&&!job.customerPhone)h+=`<td style="border:1px solid #D6D9DE"></td>`;
        h+=`</tr>`;
      }
      if(job.jobAddress)h+=`<tr><td colspan="2" style="padding:10px 14px;border:1px solid #D6D9DE"><div style="font-size:9px;font-weight:700;color:#5F6670;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Job Address</div><div style="font-weight:600;color:#0077C8">${job.jobAddress}</div></td></tr>`;
      h+=`</table>`;
      if(job.jobDescription)h+=`<div style="background:#0077C8;padding:8px 14px;margin-top:8px"><span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#fff">🔨 Work / Tasks</span></div><div style="padding:12px 14px;background:#F2F4F6;border:1px solid #D6D9DE;font-size:13px;color:#1F2329;line-height:1.7;white-space:pre-wrap">${renderBulletHtml(job.jobDescription)}</div>`;
      if(job.materials)h+=`<div style="background:#0077C8;padding:8px 14px;margin-top:8px"><span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#fff">📦 Materials Required</span></div><div style="padding:12px 14px;background:#fff;border:1px solid #D6D9DE;font-size:13px;color:#1F2329;line-height:1.7;white-space:pre-wrap">${renderBulletHtml(job.materials)}</div>`;
      if(job.specialNotes)h+=`<div style="background:#0077C8;padding:8px 14px;margin-top:8px"><span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#fff">⚠️ Special Notes</span></div><div style="padding:12px 14px;background:#F2F4F6;border:1px solid #D6D9DE;font-size:13px;color:#1F2329;line-height:1.7;white-space:pre-wrap">${renderBulletHtml(job.specialNotes)}</div>`;
      if(job.todaysTasks)h+=`<div style="background:#0077C8;padding:8px 14px;margin-top:8px"><span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#fff">📋 Today's Tasks</span></div><div style="padding:12px 14px;background:#F2F4F6;border:1px solid #D6D9DE;font-size:13px;color:#1F2329;line-height:1.7;white-space:pre-wrap">${renderBulletHtml(job.todaysTasks)}</div>`;
      if(job.jobRequests)h+=`<div style="background:#0077C8;padding:8px 14px;margin-top:8px"><span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#fff">📋 Job Requests</span></div><div style="padding:12px 14px;background:#fff;border:1px solid #D6D9DE;font-size:13px;color:#1F2329;line-height:1.7;white-space:pre-wrap">${renderBulletHtml(job.jobRequests)}</div>`;
      return h;
    };

    const w=window.open("","_blank","width=900,height=700");
    w.document.write(`<!DOCTYPE html><html><head><title>Work Order — ${members||order.crewName||""}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'Segoe UI',Arial,sans-serif;background:#F2F4F6;color:#1F2329;}
      .doc{max-width:720px;margin:0 auto;background:#fff;min-height:100vh;}
      @media print{
        body{background:#fff;}
        .doc{box-shadow:none;max-width:100%;}
        @page{margin:0.5in;}
      }
    </style>
    </head><body><div class="doc">
      <div style="background:#000;padding:0">
        <div style="padding:18px 22px 14px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:20px;font-weight:900;color:#fff;letter-spacing:2px;text-transform:uppercase">ICON REMODELING GROUP INC.</div>
            <div style="font-size:10px;font-weight:600;color:#0077C8;letter-spacing:3px;text-transform:uppercase;margin-top:2px">Daily Work Order</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <div style="background:#0077C8;color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:20px;letter-spacing:1.5px;text-transform:uppercase">${isField?"Field Operations":"Crew Assignment"}</div>
            ${order.referenceId?`<div style="background:rgba(255,255,255,0.12);color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:6px;letter-spacing:.5px;font-family:monospace;border:1px solid rgba(255,255,255,0.2)">${order.referenceId}</div>`:""}
          </div>
        </div>
        <div style="height:4px;background:#0077C8"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;background:#1F2329">
        <div style="padding:13px 18px;border-right:1px solid rgba(255,255,255,0.1)">
          <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Date</div>
          <div style="font-size:14px;font-weight:700;color:#fff">${order.date||"—"}</div>
        </div>
        <div style="padding:13px 18px">
          <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">${isField?"Staff Member":"Crew / Members"}</div>
          <div style="font-size:14px;font-weight:700;color:#fff">${members||order.crewName||"—"}</div>
        </div>
      </div>
      <div style="height:3px;background:#0077C8"></div>
      <div style="padding:16px 18px">
        ${jobs.map((job,i)=>jobHtml(job,i,jobs.length>1)).join("")}
        ${order.todaysTasks?jobHtml({todaysTasks:order.todaysTasks,jobRequests:order.jobRequests},0,false):""}
      </div>
      <div style="height:3px;background:#0077C8"></div>
      <div style="background:#1F2329;padding:12px 22px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:10px;color:rgba(255,255,255,0.4);font-weight:600;letter-spacing:1px;text-transform:uppercase">Icon Remodeling Group Inc.</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4);font-weight:600">Designed with Purpose | Built with Pride</div>
      </div>
    </div></body></html>`);
    w.document.close();
    setTimeout(()=>w.print(),600);
  }

  const saveNewPin=()=>{if(newPin.length>=4){saveToFB("settings/managerPin",newPin);setNewPin("");showToast("Manager PIN updated");}else showToast("PIN must be at least 4 digits");};
  const saveNewCrewPin=()=>{if(newCrewPin.length>=4){saveToFB("settings/crewPin",newCrewPin);setNewCrewPin("");showToast("Crew PIN updated");}else showToast("PIN must be at least 4 digits");};

  const todayStr=new Date().toISOString().split("T")[0];
  const activeCrew=getActive(orders);const activeField=getActive(fieldOrders);
  const allArchived=[...getArchived(orders).map(o=>({...o,_type:"crew"})),...getArchived(fieldOrders).map(o=>({...o,_type:"field"}))].sort((a,b)=>b.date.localeCompare(a.date));
  const crewNames=Object.keys(crews);

  if(fileViewer)return(<FileViewer file={fileViewer} onClose={()=>setFileViewer(null)}/>);
  if(docView)return(<WorkOrderDoc order={docView} onClose={()=>setDocView(null)} onFileOpen={a=>setFileViewer(a)}/>);
  if(showMaterialsForm)return(<MaterialsRequestForm activeJobs={activeJobs||[]} members={[...ALL_MEMBERS,...FIELD_OPS_MEMBERS]} onClose={()=>setShowMaterialsForm(false)} onSubmitted={()=>setShowMaterialsForm(false)} showToast={showToast}/>);
  if(materialsDetail&&materialsRequests[materialsDetail])return(<MaterialsManagerPanel request={materialsRequests[materialsDetail]} aiEnabled={aiSettings.aiMaterials!==false} onSetAiEnabled={v=>{setAiSettings(p=>({...p,aiMaterials:v}));saveToFB("settings/aiMaterials",v);}} onClose={()=>setMaterialsDetail(null)} showToast={showToast}/>);

  if(loading)return(<><SkeletonScreen rows={5}/><OpsHomeBtn/></>);

  const Toast=()=>toast?<div style={{position:"fixed",top:"20px",left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#0891B2,#22D3EE)",color:"#fff",padding:"12px 24px",borderRadius:"10px",fontSize:"14px",fontWeight:600,zIndex:1001,boxShadow:"0 4px 20px rgba(34,211,238,.4)"}}>{toast}</div>:null;
  const getLinkedLockbox=(jobIdx)=>(lockboxCodes||[]).find(c=>String(c.linkedJobIndex)===String(jobIdx));

  const saveActiveJob=(name,address,wifiName,wifiPass,garageCode,doorType,doorLocation,doorCode,customerName,jobTreadName)=>{if(!name.trim()){showToast("Job name required");return;}const now=new Date().toISOString();const jobs=[...(activeJobs||[])];const jobData={name:name.trim().toUpperCase(),address:address.trim(),lastModified:now};if(customerName&&customerName.trim())jobData.customerName=customerName.trim();if(jobTreadName&&jobTreadName.trim())jobData.jobTreadName=jobTreadName.trim();if(wifiName&&wifiName.trim())jobData.wifiName=wifiName.trim();if(wifiPass&&wifiPass.trim())jobData.wifiPassword=wifiPass.trim();if(garageCode&&garageCode.trim())jobData.garageCode=garageCode.trim();if(doorType&&doorType.trim()){jobData.doorType=doorType;if(doorLocation&&doorLocation.trim())jobData.doorLocation=doorLocation.trim();if(doorCode&&doorCode.trim())jobData.doorCode=doorCode.trim();}if(editingActiveJob!==null){jobs[editingActiveJob]=jobData;}else{jobs.push(jobData);}saveToFB("activeJobs",jobs);setNewJobName("");setNewJobAddress("");setNewJobWifiName("");setNewJobWifiPass("");setNewJobGarageCode("");setNewJobDoorType("");setNewJobDoorLocation("");setNewJobDoorCode("");setNewJobCustomerName("");setNewJobTreadName("");setEditingActiveJob(null);setShowAddJob(false);showToast(editingActiveJob!==null?"Job updated!":"Job added!");};
  const deleteActiveJob=(idx)=>{const updatedCodes=(lockboxCodes||[]).map(c=>{if(String(c.linkedJobIndex)===String(idx)){return{...c,linkedJobIndex:""};} if(Number(c.linkedJobIndex)>idx){return{...c,linkedJobIndex:String(Number(c.linkedJobIndex)-1)};} return c;});saveToFB("lockboxCodes",updatedCodes);saveToFB("activeJobs",(activeJobs||[]).filter((_,i)=>i!==idx));showToast("Removed");};


  // ── ADD / EDIT JOB SCREEN ────────────────────────────────────────────────
  if(showAddJob)return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:ff}}>
      <Toast/><OpsHomeBtn/>
      <Header title={editingActiveJob!==null?"Edit Job":"Add New Job"} onBack={()=>{setShowAddJob(false);setEditingActiveJob(null);setNewJobName("");setNewJobAddress("");setNewJobWifiName("");setNewJobWifiPass("");setNewJobGarageCode("");setNewJobDoorType("");setNewJobDoorLocation("");setNewJobDoorCode("");setNewJobCustomerName("");setNewJobTreadName("");}} onHome={goHome}/>
      <div style={{padding:"20px",maxWidth:"560px",margin:"0 auto",paddingBottom:"120px",boxSizing:"border-box"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"18px"}}>
          <div>
            <label style={labelStyle}>Job ID <span style={{color:t.danger}}>*</span></label>
            <input value={newJobName} onChange={e=>setNewJobName(e.target.value.toUpperCase())} placeholder="e.g. SHAKE SHACK" style={{...inputStyle,textTransform:"uppercase"}}/>
            <div style={{fontSize:"11px",color:t.muted,marginTop:"5px"}}>Short identifier — how it appears on the main screen</div>
          </div>
          <div>
            <label style={labelStyle}>Customer Name</label>
            <input value={newJobCustomerName} onChange={e=>setNewJobCustomerName(e.target.value.toUpperCase())} placeholder="e.g. MOUNT KISCO ASSOCIATES LLC" style={inputStyle}/>
          </div>
          <div>
            <label style={labelStyle}>Job Address</label>
            <AddressInput value={newJobAddress} onChange={e=>setNewJobAddress(e.target.value)} style={inputStyle}/>
            <div style={{fontSize:"11px",color:t.muted,marginTop:"5px"}}>Start typing and select from suggestions</div>
          </div>
          <div style={{background:"rgba(74,222,128,.05)",border:"1px solid rgba(74,222,128,.15)",borderRadius:"12px",padding:"18px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:t.green,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:"16px"}}>Site Access Info (Optional)</div>
            <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
              <div>
                <label style={labelStyle}>WiFi Name</label>
                <input value={newJobWifiName} onChange={e=>setNewJobWifiName(e.target.value)} placeholder="Network name" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>WiFi Password</label>
                <input value={newJobWifiPass} onChange={e=>setNewJobWifiPass(e.target.value)} placeholder="Password" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Garage Code</label>
                <input value={newJobGarageCode} onChange={e=>setNewJobGarageCode(e.target.value)} placeholder="Garage door code" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Door Code Type</label>
                <select value={newJobDoorType} onChange={e=>{setNewJobDoorType(e.target.value);if(!e.target.value){setNewJobDoorLocation("");setNewJobDoorCode("");}}} style={{...inputStyle,appearance:"none"}}>
                  <option value="">None</option>
                  <option value="garage">Garage</option>
                  <option value="door">Main Door</option>
                </select>
              </div>
              {newJobDoorType==="door"&&<div>
                <label style={labelStyle}>Door Location</label>
                <input value={newJobDoorLocation} onChange={e=>setNewJobDoorLocation(e.target.value)} placeholder="e.g. Front door, side entrance" style={inputStyle}/>
              </div>}
              {newJobDoorType&&<div>
                <label style={labelStyle}>Door Code</label>
                <input value={newJobDoorCode} onChange={e=>setNewJobDoorCode(e.target.value)} placeholder="Code" style={inputStyle}/>
              </div>}
            </div>
          </div>
          <div style={{display:"flex",gap:"10px"}}>
            <button onClick={()=>{setShowAddJob(false);setEditingActiveJob(null);setNewJobName("");setNewJobAddress("");setNewJobWifiName("");setNewJobWifiPass("");setNewJobGarageCode("");setNewJobDoorType("");setNewJobDoorLocation("");setNewJobDoorCode("");setNewJobCustomerName("");setNewJobTreadName("");}} style={{...baseBtn,flex:1,background:t.tag,border:`1px solid ${t.line}`,color:t.muted,padding:"14px"}}>Cancel</button>
            <button onClick={()=>saveActiveJob(newJobName,newJobAddress,newJobWifiName,newJobWifiPass,newJobGarageCode,newJobDoorType,newJobDoorLocation,newJobDoorCode,newJobCustomerName,newJobTreadName)} style={{...primaryBtn,flex:2,justifyContent:"center"}}>{editingActiveJob!==null?"Update Job":"Add Job"}</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── HOME SCREEN ──────────────────────────────────────────────────────────
  if(mode===null)return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:ff,display:"flex",flexDirection:"column",alignItems:"center"}}>
      <style>{`
        .nav-btn{display:flex;flex-direction:column;align-items:center;gap:6px;background:${t.card};border:1px solid ${t.line};border-radius:14px;padding:14px 4px 10px;cursor:pointer;transition:all 0.18s;font-family:${ff};}
        .nav-btn:hover{border-color:${t.blue};background:${t.nav};transform:translateY(-2px);}
        .icon-wrap{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;}
        .nav-label{font-size:9px;font-weight:700;color:${t.muted};text-align:center;line-height:1.3;text-transform:uppercase;letter-spacing:.4px;}
        .job-row:hover{background:${t.nav};}
        .edit-btn{font-size:12px;color:${t.muted};background:${t.card};border:1px solid ${t.line};border-radius:8px;padding:5px 14px;cursor:pointer;font-family:${ff};font-weight:600;}
        .edit-btn:hover{color:${t.blue};border-color:${t.blue};}
        .job-ctx-menu button:hover{background:${t.tag} !important;}
      `}</style>
      <Toast/>

      {keyModal&&<InfoModal title="Lock Box Code" icon={<span style={{color:t.amber}}><KeyIcon/></span>} onClose={()=>setKeyModal(null)}>
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          {keyModal.jobName&&<div><div style={labelStyle}>Job</div><div style={{fontSize:"15px",fontWeight:700,color:t.text}}>{keyModal.jobName}</div></div>}
          {keyModal.jobLocation&&<div><div style={labelStyle}>Location</div><div style={{fontSize:"14px",color:t.text}}>{keyModal.jobLocation}</div></div>}
          {keyModal.keyBoxLocation&&<div><div style={labelStyle}>Key Box Location</div><div style={{fontSize:"14px",color:t.text}}>{keyModal.keyBoxLocation}</div></div>}
          <div style={{background:"rgba(245,158,11,.1)",border:"1.5px solid rgba(245,158,11,.3)",borderRadius:"12px",padding:"18px",textAlign:"center"}}>
            <div style={{...labelStyle,color:t.amber}}>Key Box Code</div>
            <div style={{fontSize:"34px",fontWeight:700,color:t.amber,letterSpacing:"8px"}}>{keyModal.keyBoxCode||"?"}</div>
          </div>
        </div>
      </InfoModal>}
      {wifiModal&&<InfoModal title="WiFi Info" icon={<span style={{color:t.green}}><WifiIcon/></span>} onClose={()=>setWifiModal(null)}>
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <div style={{background:"rgba(74,222,128,.1)",border:"1.5px solid rgba(74,222,128,.25)",borderRadius:"12px",padding:"14px"}}><div style={{...labelStyle,color:t.green}}>Network</div><div style={{fontSize:"17px",fontWeight:700,color:t.green}}>{wifiModal.wifiName||"?"}</div></div>
          <div style={{background:"rgba(74,222,128,.1)",border:"1.5px solid rgba(74,222,128,.25)",borderRadius:"12px",padding:"14px"}}><div style={{...labelStyle,color:t.green}}>Password</div><div style={{fontSize:"17px",fontWeight:700,color:t.green,wordBreak:"break-all"}}>{wifiModal.wifiPassword||"?"}</div></div>
        </div>
      </InfoModal>}
      {doorModal&&<InfoModal title={doorModal.type==="garage"?"Garage Code":"Door Code"} icon={<span style={{color:t.purple}}>{doorModal.type==="garage"?<GarageIcon/>:<DoorIcon/>}</span>} onClose={()=>setDoorModal(null)}>
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          {doorModal.doorLocation&&<div style={{background:"rgba(167,139,250,.1)",border:"1.5px solid rgba(167,139,250,.25)",borderRadius:"12px",padding:"14px"}}><div style={{...labelStyle,color:t.purple}}>Location</div><div style={{fontSize:"14px",color:t.text}}>{doorModal.doorLocation}</div></div>}
          <div style={{background:"rgba(167,139,250,.1)",border:"1.5px solid rgba(167,139,250,.25)",borderRadius:"12px",padding:"18px",textAlign:"center"}}><div style={{...labelStyle,color:t.purple}}>Code</div><div style={{fontSize:"34px",fontWeight:700,color:t.purple,letterSpacing:"8px"}}>{doorModal.code||"?"}</div></div>
        </div>
      </InfoModal>}

      <div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center"}}>
        {/* HEADER */}
        <div style={{width:"100%",background:t.nav,borderBottom:`1px solid ${t.line}`,padding:"18px 20px 14px",textAlign:"center",position:"relative",boxShadow:"0 2px 20px rgba(0,0,0,.4)"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:"3px",background:`linear-gradient(90deg,${t.red},${t.blue},${t.green})`}}/>
          <div style={{fontSize:"19px",fontWeight:800,color:t.red,letterSpacing:"1px",textTransform:"uppercase"}}>Icon Remodeling Group Inc.</div>
          <div style={{fontSize:"10px",fontWeight:600,color:"rgba(255,255,255,.65)",letterSpacing:"3px",textTransform:"uppercase",marginTop:"3px"}}>Work Orders / Field Operations</div>
        </div>

        {/* NAV — amber=manager, green=crews, purple=ops, cyan=access */}
        <div style={{background:t.bg,width:"100%",padding:"16px 14px 14px",borderBottom:`1px solid ${t.line}`}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"7px",maxWidth:"560px",margin:"0 auto"}}>
            <button className="nav-btn" onClick={()=>setPinDialog("manager")} style={{position:"relative"}}>
              <div className="icon-wrap" style={{background:"rgba(245,158,11,.12)",border:"1.5px solid rgba(245,158,11,.25)"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" fill="#F59E0B"/></svg>
              </div>
              <span className="nav-label">Manager</span>
              {unreadActivity>0?<span style={{position:"absolute",top:"6px",right:"6px",minWidth:"18px",height:"18px",padding:"0 5px",background:t.danger,borderRadius:"9px",fontSize:"10px",fontWeight:800,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 8px rgba(244,63,94,.6)"}}>{unreadActivity>99?"99+":unreadActivity}</span>:managerUpdates&&<span style={{position:"absolute",top:"8px",right:"8px",width:"7px",height:"7px",background:t.danger,borderRadius:"50%"}}/>}
            </button>
            <button className="nav-btn" onClick={()=>setMode("crew")} style={{position:"relative"}}>
              <div className="icon-wrap" style={{background:"rgba(74,222,128,.1)",border:"1.5px solid rgba(74,222,128,.22)"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="5" y="6" width="14" height="15" rx="1.5" stroke="#4ADE80" strokeWidth="1.4" fill="none"/><path d="M9 9l2 2 4-4" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 14h6M9 17h4" stroke="#4ADE80" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/></svg>
              </div>
              <span className="nav-label">Field Crews</span>
              {crewUpdates&&<span style={{position:"absolute",top:"8px",right:"8px",width:"7px",height:"7px",background:t.danger,borderRadius:"50%"}}/>}
            </button>
            <button className="nav-btn" onClick={()=>setMode("fieldops")} style={{position:"relative"}}>
              <div className="icon-wrap" style={{background:"rgba(167,139,250,.1)",border:"1.5px solid rgba(167,139,250,.22)"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span className="nav-label">Operations</span>
              {fieldUpdates&&<span style={{position:"absolute",top:"8px",right:"8px",width:"7px",height:"7px",background:t.danger,borderRadius:"50%"}}/>}
            </button>
            <button className="nav-btn" onClick={()=>setMode("lockbox")} style={{position:"relative"}}>
              <div className="icon-wrap" style={{background:"rgba(34,211,238,.08)",border:"1.5px solid rgba(34,211,238,.2)"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="#22D3EE" strokeWidth="1.4"/><path d="M8 11V7a4 4 0 018 0v4" stroke="#22D3EE" strokeWidth="1.4" strokeLinecap="round"/><circle cx="12" cy="16" r="1.8" fill="#22D3EE"/></svg>
              </div>
              <span className="nav-label">Access Codes</span>
              {lockboxUpdates&&<span style={{position:"absolute",top:"8px",right:"8px",width:"7px",height:"7px",background:t.danger,borderRadius:"50%"}}/>}
            </button>
            <button className="nav-btn" onClick={()=>setMode("files")} style={{position:"relative"}}>
              <div className="icon-wrap" style={{background:"rgba(244,63,94,.08)",border:"1.5px solid rgba(244,63,94,.22)"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
              </div>
              <span className="nav-label">All Files</span>
            </button>
          </div>
        </div>

        {/* OPS CENTER LINK */}
        <div style={{width:"100%",padding:"0 14px 10px",background:t.bg}}>
          <a href="https://icon-operations-center.vercel.app" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",width:"100%",maxWidth:"480px",margin:"0 auto",padding:"10px 14px",background:"rgba(79,127,255,0.08)",border:"1px solid rgba(79,127,255,0.25)",borderRadius:"10px",color:"#7AAEFF",fontSize:"12px",fontWeight:700,letterSpacing:".5px",textTransform:"uppercase",textDecoration:"none",boxSizing:"border-box",fontFamily:ff}}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Operations Center
          </a>
        </div>

        {/* ACTIVE JOBS */}
        <div style={{width:"100%",maxWidth:"600px",padding:"16px 14px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
            <span style={{fontSize:"11px",fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:"1.4px"}}>Active Jobs</span>
            <button className="edit-btn" onClick={()=>setPinDialog("addJob")}>+ Add New Job</button>
          </div>
          <div style={{height:"1px",background:`linear-gradient(90deg,transparent,${t.line},transparent)`,marginBottom:"10px"}}/>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
            <thead><tr>
              <th style={{textAlign:"left",padding:"5px 10px 7px",borderBottom:`1px solid ${t.line}`,fontSize:"10px",fontWeight:700,color:t.muted,letterSpacing:"1.2px",textTransform:"uppercase",width:"24%"}}>Job ID</th>
              <th style={{textAlign:"left",padding:"5px 10px 7px",borderBottom:`1px solid ${t.line}`,fontSize:"10px",fontWeight:700,color:t.muted,letterSpacing:"1.2px",textTransform:"uppercase",width:"22%"}}>Customer</th>
              <th style={{textAlign:"left",padding:"5px 10px 7px",borderBottom:`1px solid ${t.line}`,fontSize:"10px",fontWeight:700,color:t.muted,letterSpacing:"1.2px",textTransform:"uppercase"}}>Address</th>
              <th style={{width:"36px",borderBottom:`1px solid ${t.line}`}}/>
            </tr></thead>
            <tbody>
              {(activeJobs||[]).map((job,idx)=>({job,idx})).sort((a,b)=>(a.job.name||"").localeCompare(b.job.name||"")).map(({job,idx})=>{
                const linked=getLinkedLockbox(idx);const hasWifi=!!(job.wifiName||job.wifiPassword);const hasGarage=!!job.garageCode;const hasDoor=!!(job.doorType&&job.doorCode);
                return(
                  <tr key={idx} className="job-row">
                    <td style={{padding:"11px 10px",borderBottom:`1px solid ${t.line}`,fontWeight:700,color:t.text,fontSize:"12px",textTransform:"uppercase",verticalAlign:"top"}}>{job.name}</td>
                    <td style={{padding:"11px 10px",borderBottom:`1px solid ${t.line}`,fontSize:"12px",color:t.text,verticalAlign:"top"}}>{job.customerName||<span style={{color:t.muted,fontStyle:"italic"}}>—</span>}</td>
                    <td style={{padding:"11px 10px",borderBottom:`1px solid ${t.line}`,verticalAlign:"top"}}>
                      <div style={{display:"flex",flexDirection:"column",gap:"5px"}}>
                        <span style={{color:"rgba(240,244,255,.7)",fontSize:"12px"}}>{job.address}</span>
                        <div style={{display:"flex",alignItems:"center",gap:"5px",flexWrap:"wrap"}}>
                          {linked&&<button onClick={()=>setKeyModal(linked)} style={{...baseBtn,padding:"2px 7px",background:"rgba(245,158,11,.12)",border:"1.5px solid rgba(245,158,11,.28)",borderRadius:"7px",color:t.amber,gap:"3px",fontSize:"11px",fontWeight:700}}><KeyIcon/> Code</button>}
                          {hasWifi&&<button onClick={()=>setWifiModal({wifiName:job.wifiName,wifiPassword:job.wifiPassword})} style={{...baseBtn,padding:"2px 7px",background:"rgba(74,222,128,.1)",border:"1.5px solid rgba(74,222,128,.22)",borderRadius:"7px",color:t.green,gap:"3px",fontSize:"11px",fontWeight:700}}><WifiIcon/> WiFi</button>}
                          {hasGarage&&<button onClick={()=>setDoorModal({type:"garage",code:job.garageCode})} style={{...baseBtn,padding:"2px 7px",background:"rgba(167,139,250,.1)",border:"1.5px solid rgba(167,139,250,.22)",borderRadius:"7px",color:t.purple,gap:"3px",fontSize:"11px",fontWeight:700}}><GarageIcon/> Garage</button>}
                          {hasDoor&&<button onClick={()=>setDoorModal({type:job.doorType,code:job.doorCode,doorLocation:job.doorLocation})} style={{...baseBtn,padding:"2px 7px",background:"rgba(34,211,238,.08)",border:"1.5px solid rgba(34,211,238,.2)",borderRadius:"7px",color:t.cyan,gap:"3px",fontSize:"11px",fontWeight:700}}><DoorIcon/> Door</button>}
                        </div>
                      </div>
                    </td>
                    <td style={{padding:"8px 4px",borderBottom:`1px solid ${t.line}`,verticalAlign:"top"}}>
                      <div style={{position:"relative"}}>
                        <button onClick={()=>setJobMenu(jobMenu===idx?null:idx)} style={{...ghostBtn,padding:"5px",color:t.muted,borderRadius:"8px"}}><DotsIcon/></button>
                        {jobMenu===idx&&<>
                          <div onClick={()=>setJobMenu(null)} style={{position:"fixed",inset:0,zIndex:998}}/>
                          <div style={{position:"absolute",right:0,top:"100%",background:t.nav,border:`1px solid ${t.line}`,borderRadius:"10px",boxShadow:"0 4px 20px rgba(0,0,0,.6)",zIndex:999,minWidth:"130px",overflow:"hidden"}}>
                            <button onClick={()=>{setJobMenu(null);setPinDialog({type:"editJob",index:idx});}} style={{display:"block",width:"100%",padding:"10px 14px",background:"transparent",border:"none",color:t.blue,fontSize:"13px",fontWeight:600,textAlign:"left",cursor:"pointer",fontFamily:ff}}>✏️ Edit</button>
                            <button onClick={()=>{setJobMenu(null);setPinDialog({type:"deleteJob",index:idx});}} style={{display:"block",width:"100%",padding:"10px 14px",background:"transparent",border:"none",color:t.danger,fontSize:"13px",fontWeight:600,textAlign:"left",cursor:"pointer",fontFamily:ff,borderTop:`1px solid ${t.line}`}}>🗑️ Delete</button>
                          </div>
                        </>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(activeJobs||[]).length===0&&<div style={{textAlign:"center",padding:"24px",color:t.muted,fontSize:"13px"}}>No active jobs</div>}
        </div>
        {/* Status bar */}
        <div style={{width:"100%",background:t.nav,borderTop:`1px solid ${t.line}`,padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:"11px",color:t.muted,display:"flex",alignItems:"center",gap:"6px"}}>
            <span style={{width:"7px",height:"7px",background:t.green,borderRadius:"50%",display:"inline-block",boxShadow:`0 0 6px ${t.green}`}}/>Live
          </span>
          <span style={{fontSize:"11px",color:t.muted}}>{(activeJobs||[]).length} Active Jobs</span>
        </div>
      </div>
      {pinDialog==="manager"&&<PinDialog title="Enter Manager PIN" onSuccess={()=>{setPinDialog(null);setManagerAuth(true);setMode("manager");}} onCancel={()=>setPinDialog(null)}/>}
      {pinDialog==="addJob"&&<PinDialog title="Admin Code — Add New Job" onSuccess={()=>{setPinDialog(null);setNewJobName("");setNewJobAddress("");setNewJobWifiName("");setNewJobWifiPass("");setNewJobGarageCode("");setNewJobDoorType("");setNewJobDoorLocation("");setNewJobDoorCode("");setNewJobCustomerName("");setNewJobTreadName("");setEditingActiveJob(null);setShowAddJob(true);}} onCancel={()=>setPinDialog(null)}/>}
      {pinDialog?.type==="editJob"&&<PinDialog title="Admin Code — Edit Job" onSuccess={()=>{const idx=pinDialog.index;const job=(activeJobs||[])[idx];setNewJobName(job.name||"");setNewJobAddress(job.address||"");setNewJobWifiName(job.wifiName||"");setNewJobWifiPass(job.wifiPassword||"");setNewJobGarageCode(job.garageCode||"");setNewJobDoorType(job.doorType||"");setNewJobDoorLocation(job.doorLocation||"");setNewJobDoorCode(job.doorCode||"");setNewJobCustomerName(job.customerName||"");setNewJobTreadName(job.jobTreadName||"");setEditingActiveJob(idx);setPinDialog(null);setShowAddJob(true);}} onCancel={()=>setPinDialog(null)}/>}
      {pinDialog?.type==="deleteJob"&&<PinDialog title="Admin Code — Delete Job" onSuccess={()=>{setDeleteJobConfirm(pinDialog.index);setPinDialog(null);}} onCancel={()=>setPinDialog(null)}/>}
      {deleteJobConfirm!==null&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <div style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"18px",padding:"28px",maxWidth:"320px",width:"100%",textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,.6)"}}>
          <div style={{fontSize:"17px",fontWeight:700,color:t.text,marginBottom:"8px"}}>Delete Job?</div>
          <div style={{fontSize:"14px",color:t.muted,marginBottom:"6px"}}>Are you sure you want to delete</div>
          <div style={{fontSize:"16px",fontWeight:700,color:t.danger,marginBottom:"22px"}}>"{(activeJobs||[])[deleteJobConfirm]?.name}"?</div>
          <div style={{display:"flex",gap:"10px"}}>
            <button onClick={()=>setDeleteJobConfirm(null)} style={{...baseBtn,flex:1,background:t.tag,border:`1px solid ${t.line}`,color:t.muted,padding:"13px"}}>No, Cancel</button>
            <button onClick={()=>{deleteActiveJob(deleteJobConfirm);setDeleteJobConfirm(null);}} style={{...baseBtn,flex:1,background:t.danger,color:"#fff",padding:"13px",fontWeight:700,borderRadius:"10px"}}>Yes, Delete</button>
          </div>
        </div>
      </div>}
    </div>
  );

  // ── LOCK BOX CODES ────────────────────────────────────────────────────────
  if(mode==="lockbox"){
    const codes=lockboxCodes||[];const jobs=activeJobs||[];
    const allEntries=[...codes.map((c,i)=>({...c,_source:"lockbox",_idx:i})),...jobs.flatMap((job,ji)=>{const entries=[];if(job.garageCode)entries.push({_source:"job-garage",_jobIdx:ji,jobName:job.name,jobLocation:job.address,code:job.garageCode,label:"Garage Door Code"});if(job.doorType&&job.doorCode)entries.push({_source:"job-door",_jobIdx:ji,jobName:job.name,jobLocation:job.address,code:job.doorCode,doorLocation:job.doorLocation,doorType:job.doorType,label:job.doorType==="garage"?"Garage Code":"Door Code"});return entries;})];
    const selected=selectedLockbox!==null?allEntries[selectedLockbox]:null;
    const entryColor=(e)=>e._source==="lockbox"?t.amber:e._source==="job-garage"||e.doorType==="garage"?t.purple:t.cyan;
    const entryBg=(e)=>e._source==="lockbox"?"rgba(245,158,11,.08)":e._source==="job-garage"||e.doorType==="garage"?"rgba(167,139,250,.08)":"rgba(34,211,238,.06)";
    const entryBorder=(e)=>e._source==="lockbox"?"rgba(245,158,11,.22)":e._source==="job-garage"||e.doorType==="garage"?"rgba(167,139,250,.22)":"rgba(34,211,238,.18)";
    const entryIcon=(e)=>e._source==="lockbox"?<KeyIcon/>:e._source==="job-garage"||e.doorType==="garage"?<GarageIcon/>:<DoorIcon/>;
    return(<div style={{minHeight:"100vh",background:t.bg,fontFamily:ff}}><Toast/>
      <OpsHomeBtn/>
      <Header title={selected?"Access Code Details":"Job Access Codes"} subtitle={`${allEntries.length} locations`} onBack={()=>{if(selected)setSelectedLockbox(null);else goHome();}} onHome={goHome}/>
      <div style={{padding:"20px",paddingBottom:"100px"}}>
        {selected?(<div style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"14px",padding:"22px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"18px"}}>
            <span style={{color:entryColor(selected)}}>{entryIcon(selected)}</span>
            <h2 style={{fontSize:"19px",color:t.text,margin:0,fontWeight:700,fontFamily:ff}}>{selected.jobName||selected.jobLocation}</h2>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            {selected._source==="lockbox"&&<>
              {selected.jobName&&<div><div style={labelStyle}>Job Name</div><div style={{fontSize:"14px",color:t.text,fontWeight:600}}>{selected.jobName}</div></div>}
              <div><div style={labelStyle}>Location</div><div style={{fontSize:"14px",color:t.text}}>{selected.jobLocation}</div></div>
              <div><div style={labelStyle}>Key Box Location</div><div style={{fontSize:"14px",color:t.text}}>{selected.keyBoxLocation||"?"}</div></div>
              <div style={{background:"rgba(245,158,11,.1)",border:"1.5px solid rgba(245,158,11,.28)",borderRadius:"12px",padding:"18px",textAlign:"center"}}><div style={{...labelStyle,color:t.amber}}>Key Box Code</div><div style={{fontSize:"32px",fontWeight:700,color:t.amber,letterSpacing:"6px"}}>{selected.keyBoxCode||"?"}</div></div>
            </>}
            {(selected._source==="job-garage"||selected._source==="job-door")&&<>
              <div><div style={labelStyle}>Job</div><div style={{fontSize:"14px",color:t.text,fontWeight:600}}>{selected.jobName}</div></div>
              {selected.jobLocation&&<div><div style={labelStyle}>Address</div><div style={{fontSize:"13px",color:t.text}}>{selected.jobLocation}</div></div>}
              {selected.doorLocation&&<div><div style={labelStyle}>Door Location</div><div style={{fontSize:"13px",color:t.text}}>{selected.doorLocation}</div></div>}
              <div style={{background:"rgba(167,139,250,.1)",border:"1.5px solid rgba(167,139,250,.28)",borderRadius:"12px",padding:"18px",textAlign:"center"}}><div style={{...labelStyle,color:t.purple}}>Code</div><div style={{fontSize:"32px",fontWeight:700,color:t.purple,letterSpacing:"6px"}}>{selected.code||"?"}</div></div>
            </>}
          </div>
        </div>):(
          <>{allEntries.length===0?<div style={{textAlign:"center",padding:"48px",color:t.muted}}>No access codes yet.</div>:
          <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>{allEntries.map((entry,idx)=>(<button key={idx} onClick={()=>setSelectedLockbox(idx)} style={{...baseBtn,background:entryBg(entry),border:`1.5px solid ${entryBorder(entry)}`,padding:"16px 18px",borderRadius:"12px",justifyContent:"flex-start",color:t.text,width:"100%",textAlign:"left",gap:"12px"}}>
            <span style={{color:entryColor(entry)}}>{entryIcon(entry)}</span>
            <div>
              <div style={{fontSize:"14px",fontWeight:600,color:t.text}}>{entry.jobName||entry.jobLocation}</div>
              <div style={{fontSize:"11px",color:entryColor(entry),marginTop:"2px",fontWeight:600,textTransform:"uppercase",letterSpacing:".5px"}}>{entry._source==="lockbox"?"Lock Box":entry.label}</div>
            </div>
          </button>))}</div>}</>
        )}
      </div>
    </div>);
  }

  // ── MANAGE LOCK BOX ───────────────────────────────────────────────────────
  if(mode==="manageLockbox"){
    const codes=lockboxCodes||[];const jobs=activeJobs||[];
    const saveLockbox=()=>{if(!lockboxForm.jobLocation.trim()){showToast("Location required");return;}const now=new Date().toISOString();const d={...lockboxForm,linkedJobIndex:lockboxForm.linkedJobIndex!==""?lockboxForm.linkedJobIndex:"",lastModified:now};let u;if(editingLockbox!==null){u=codes.map((c,i)=>i===editingLockbox?d:c);}else{u=[...codes,d];}saveToFB("lockboxCodes",u);setShowLockboxForm(false);setEditingLockbox(null);setLockboxForm({jobName:"",jobLocation:"",keyBoxLocation:"",keyBoxCode:"",linkedJobIndex:""});showToast("Saved");};
    const deleteLockbox=(idx)=>{if(!window.confirm("Delete?"))return;saveToFB("lockboxCodes",codes.filter((_,i)=>i!==idx));showToast("Deleted");};
    return(<div style={{minHeight:"100vh",background:t.bg,fontFamily:ff}}><Toast/>
      <OpsHomeBtn/>
      <Header title="Manage Lock Box Codes" onBack={()=>{setShowLockboxForm(false);setEditingLockbox(null);setMode("manager");}} onHome={goHome}>
        {!showLockboxForm&&<button onClick={()=>{setLockboxForm({jobName:"",jobLocation:"",keyBoxLocation:"",keyBoxCode:"",linkedJobIndex:""});setEditingLockbox(null);setShowLockboxForm(true);}} style={{...primaryBtn,padding:"10px 16px",fontSize:"14px"}}><PlusIcon/> Add</button>}
      </Header>
      <div style={{padding:"20px",paddingBottom:"100px"}}>
        {showLockboxForm?(<div>
          <h2 style={{fontSize:"19px",color:t.text,margin:"0 0 18px",fontWeight:700,fontFamily:ff}}>{editingLockbox!==null?"Edit":"New"} Lock Box</h2>
          <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
            <div><label style={labelStyle}>Job Name</label><input value={lockboxForm.jobName||""} onChange={e=>setLockboxForm({...lockboxForm,jobName:e.target.value})} placeholder="Job name" style={inputStyle}/></div>
            <div><label style={labelStyle}>Job Location</label><AddressInput value={lockboxForm.jobLocation} onChange={e=>setLockboxForm({...lockboxForm,jobLocation:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>Key Box Location</label><input value={lockboxForm.keyBoxLocation} onChange={e=>setLockboxForm({...lockboxForm,keyBoxLocation:e.target.value})} placeholder="e.g. Front door handle" style={inputStyle}/></div>
            <div><label style={labelStyle}>Key Box Code</label><input value={lockboxForm.keyBoxCode} onChange={e=>setLockboxForm({...lockboxForm,keyBoxCode:e.target.value})} placeholder="e.g. 4589" style={inputStyle}/></div>
            <div style={{background:"rgba(245,158,11,.07)",border:"1.5px solid rgba(245,158,11,.18)",borderRadius:"12px",padding:"14px"}}>
              <label style={{...labelStyle,color:t.amber}}>Link to Active Job (optional)</label>
              <select value={lockboxForm.linkedJobIndex} onChange={e=>setLockboxForm({...lockboxForm,linkedJobIndex:e.target.value})} style={{...inputStyle,background:"rgba(245,158,11,.04)"}}><option value="">No link</option>{jobs.map((job,i)=><option key={i} value={String(i)}>{job.name}{job.address?` - ${job.address}`:""}</option>)}</select>
            </div>
            <div style={{display:"flex",gap:"10px"}}><button onClick={()=>{setShowLockboxForm(false);setEditingLockbox(null);}} style={{...baseBtn,flex:1,background:t.tag,border:`1px solid ${t.line}`,color:t.muted,padding:"14px"}}>Cancel</button><button onClick={saveLockbox} style={{...primaryBtn,flex:2,justifyContent:"center"}}>{editingLockbox!==null?"Update":"Save"}</button></div>
          </div></div>):(
          <>{codes.length===0?<div style={{textAlign:"center",padding:"48px",color:t.muted}}>No lock box codes yet.</div>:
          <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>{codes.map((code,idx)=>(<div key={idx} style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"12px",padding:"16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:"14px",fontWeight:700,color:t.text,marginBottom:"2px"}}>{code.jobName||code.jobLocation}</div><div style={{fontSize:"12px",color:t.muted}}>Code: <span style={{color:t.amber,fontWeight:700}}>{code.keyBoxCode}</span></div></div>
            <div style={{display:"flex",gap:"4px"}}><button onClick={()=>{setLockboxForm({jobName:code.jobName||"",jobLocation:code.jobLocation,keyBoxLocation:code.keyBoxLocation,keyBoxCode:code.keyBoxCode,linkedJobIndex:code.linkedJobIndex!==undefined?String(code.linkedJobIndex):""});setEditingLockbox(idx);setShowLockboxForm(true);}} style={{...ghostBtn,padding:"6px",color:t.blue}}><EditIcon/></button><button onClick={()=>deleteLockbox(idx)} style={{...ghostBtn,padding:"6px",color:t.danger}}><TrashIcon/></button></div>
          </div>))}</div>}</>
        )}
      </div>
    </div>);
  }

  // ── FIELD NOTES ───────────────────────────────────────────────────────────
  if(mode==="fieldnotes"){
    const allJobs=[...activeCrew.map(o=>({label:`${(o.members||[]).join(", ")} - ${o.jobAddress}`,date:o.date})),...activeField.map(o=>({label:`${(o.staffMember||[]).join(", ")} - Field Ops`,date:o.date}))];
    const submitNote=async()=>{if(!noteText.trim()&&noteAtts.length===0){showToast("Add notes or photos first");return;}await addFieldNote({jobRef:selectedJob||"General",notes:noteText,attachments:noteAtts,submittedBy:"Crew"});setNoteText("");setNoteAtts([]);setSelectedJob("");};
    const handleNoteUpload=async(e)=>{
    const files=Array.from(e.target.files);if(!files.length)return;setUploading(true);
    const atts=[...noteAtts];
    for(const f of files){
      const dn=window.prompt("Name:",f.name.replace(/\.[^.]+$/,""))||f.name;
      const result=await processFileForUpload(f,showToast);
      if(result.warn)showToast(result.warn);
      try{
        if(result.multiPage&&result.files){
          for(let pi=0;pi<result.files.length;pi++){
            const pf=result.files[pi];
            const label=result.files.length>1?`${dn} — Page ${pi+1}`:dn;
            const fn=`${Date.now()}_${pf.name}`;const fr=storageRef(storage,`fieldnotes/${fn}`);
            await uploadBytes(fr,pf);const url=await getDownloadURL(fr);
            atts.push({name:label,url,uploadedAt:new Date().toISOString(),converted:true});
          }
        } else {
          const uf=result.file;const fn=`${Date.now()}_${uf.name}`;
          const fr=storageRef(storage,`fieldnotes/${fn}`);
          await uploadBytes(fr,uf);const url=await getDownloadURL(fr);
          atts.push({name:dn,url,uploadedAt:new Date().toISOString(),converted:!!result.wasConverted});
        }
      }catch(err){showToast("Failed");}
    }
    setNoteAtts(atts);setUploading(false);showToast("Uploaded");e.target.value="";
  };
    const handleCamera=async(e)=>{const file=e.target.files[0];if(!file)return;setUploading(true);const dn=window.prompt("Name photo:",`Photo`)||file.name;try{const fn=`${Date.now()}_${file.name}`;const fr=storageRef(storage,`fieldnotes/${fn}`);await uploadBytes(fr,file);const url=await getDownloadURL(fr);setNoteAtts([...noteAtts,{name:dn,url,uploadedAt:new Date().toISOString()}]);}catch(err){showToast("Failed");}setUploading(false);e.target.value="";};
    return(<div style={{minHeight:"100vh",background:t.bg,fontFamily:ff}}><Toast/>
      <OpsHomeBtn/>
      <Header title="Field Notes & Photos" subtitle={today} onBack={goHome} onHome={goHome}/>
      <div style={{padding:"20px",paddingBottom:"100px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"14px",marginBottom:"24px"}}>
          <div><label style={labelStyle}>Link to Work Order</label><select value={selectedJob} onChange={e=>setSelectedJob(e.target.value)} style={{...inputStyle,appearance:"none"}}><option value="">General</option>{allJobs.map((j,i)=><option key={i} value={j.label}>{j.label} ({j.date})</option>)}</select></div>
          <div><label style={labelStyle}>Notes</label><BulletTextarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Type field notes..." style={inputStyle}/></div>
          <div style={{display:"flex",gap:"8px"}}>
            <input ref={noteFileRef} type="file" multiple onChange={handleNoteUpload} style={{display:"none"}}/>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleCamera} style={{display:"none"}}/>
            <button onClick={()=>noteFileRef.current?.click()} disabled={uploading} style={{...baseBtn,flex:1,background:t.card,border:`1px solid ${t.line}`,color:t.text,padding:"12px",fontSize:"13px"}}><PaperclipIcon/> Attach</button>
            <button onClick={()=>cameraRef.current?.click()} disabled={uploading} style={{...baseBtn,flex:1,background:t.card,border:`1px solid ${t.line}`,color:t.text,padding:"12px",fontSize:"13px"}}><CameraIcon/> Photo</button>
          </div>
          {noteAtts.length>0&&<div style={{display:"flex",flexDirection:"column",gap:"6px"}}>{noteAtts.map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:t.card,padding:"8px 12px",borderRadius:"8px",border:`1px solid ${t.line}`}}><span style={{fontSize:"13px",color:t.cyan,display:"flex",alignItems:"center",gap:"4px"}}><PaperclipIcon/>{a.name}</span><button onClick={()=>setNoteAtts(noteAtts.filter((_,x)=>x!==i))} style={{...ghostBtn,padding:"4px",color:t.danger}}><TrashIcon/></button></div>)}</div>}
          <button onClick={submitNote} disabled={uploading} style={{...primaryBtn,width:"100%",justifyContent:"center"}}>Submit Note</button>
        </div>
        <div style={{fontSize:"14px",fontWeight:700,color:t.text,marginBottom:"12px",borderTop:`1px solid ${t.line}`,paddingTop:"18px"}}>Previous Notes</div>
        {(fieldNotes||[]).length===0?<div style={{textAlign:"center",padding:"32px",color:t.muted}}>No notes yet</div>:
        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>{[...(fieldNotes||[])].reverse().map((n,i)=>(<div key={i} style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"12px",padding:"14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px"}}><span style={{fontSize:"12px",fontWeight:700,color:t.cyan}}>{n.jobRef||"General"}</span><span style={{fontSize:"11px",color:t.muted}}>{n.submittedAt?new Date(n.submittedAt).toLocaleDateString():""}</span></div>
          {n.notes&&<div style={{fontSize:"13px",color:t.text,lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:"8px"}}>{renderBullet(n.notes)}</div>}
          {n.attachments?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>{n.attachments.map((a,j)=><a key={j} href={a.url} onClick={e=>{e.preventDefault();setFileViewer(a);}} style={{fontSize:"12px",background:"rgba(34,211,238,.08)",padding:"3px 10px",borderRadius:"6px",color:t.cyan,textDecoration:"none",border:"1px solid rgba(34,211,238,.18)",display:"flex",alignItems:"center",gap:"4px"}}><PaperclipIcon/>{a.name}</a>)}</div>}
        </div>))}</div>}
      </div>
    </div>);
  }

  // ── FILES ─────────────────────────────────────────────────────────────────
  if(mode==="files"){
    const allAtts=[];
    (orders||[]).forEach((o,oi)=>(o.attachments||[]).forEach((a,ai)=>allAtts.push({...a,source:o.crewName||"Crew",members:(o.members||[]).join(", "),date:o.date,orderType:"crew",orderIdx:oi,attIdx:ai})));
    (fieldOrders||[]).forEach((o,oi)=>(o.attachments||[]).forEach((a,ai)=>allAtts.push({...a,source:"Field Ops",members:(o.staffMember||[]).join(", "),date:o.date,orderType:"field",orderIdx:oi,attIdx:ai})));
    (fieldNotes||[]).forEach((n,ni)=>(n.attachments||[]).forEach((a,ai)=>allAtts.push({...a,source:"Field Note",members:n.jobRef||"",date:n.submittedAt?n.submittedAt.split("T")[0]:"",orderType:"note",orderIdx:ni,attIdx:ai})));
    (standaloneFiles||[]).forEach((a,ai)=>allAtts.push({...a,source:"Direct Upload",members:"",date:a.uploadedAt?a.uploadedAt.split("T")[0]:"",orderType:"standalone",attIdx:ai}));
    allAtts.sort((a,b)=>(b.uploadedAt||b.date||"").localeCompare(a.uploadedAt||a.date||""));
    const handleRenameFile=(att)=>{const nn=window.prompt("Rename:",att.name);if(!nn||!nn.trim())return;if(att.orderType==="crew"){saveToFB("orders",orders.map((o,i)=>i===att.orderIdx?{...o,attachments:(o.attachments||[]).map((a,j)=>j===att.attIdx?{...a,name:nn.trim()}:a)}:o));}else if(att.orderType==="field"){saveToFB("fieldOrders",fieldOrders.map((o,i)=>i===att.orderIdx?{...o,attachments:(o.attachments||[]).map((a,j)=>j===att.attIdx?{...a,name:nn.trim()}:a)}:o));}else if(att.orderType==="note"){saveToFB("fieldNotes",(fieldNotes||[]).map((o,i)=>i===att.orderIdx?{...o,attachments:(o.attachments||[]).map((a,j)=>j===att.attIdx?{...a,name:nn.trim()}:a)}:o));}else if(att.orderType==="standalone"){saveToFB("standaloneFiles",(standaloneFiles||[]).map((a,i)=>i===att.attIdx?{...a,name:nn.trim()}:a));}showToast("Renamed");};
    const handleDeleteFile=(att)=>{if(!window.confirm("Delete?"))return;if(att.orderType==="standalone"){saveToFB("standaloneFiles",(standaloneFiles||[]).filter((_,i)=>i!==att.attIdx));}else if(att.orderType==="crew"){saveToFB("orders",orders.map((o,i)=>i===att.orderIdx?{...o,attachments:(o.attachments||[]).filter((_,j)=>j!==att.attIdx)}:o));}else if(att.orderType==="field"){saveToFB("fieldOrders",fieldOrders.map((o,i)=>i===att.orderIdx?{...o,attachments:(o.attachments||[]).filter((_,j)=>j!==att.attIdx)}:o));}else if(att.orderType==="note"){saveToFB("fieldNotes",(fieldNotes||[]).map((o,i)=>i===att.orderIdx?{...o,attachments:(o.attachments||[]).filter((_,j)=>j!==att.attIdx)}:o));}showToast("Deleted");};
    const handleDirectUpload=async(e)=>{
    const files=Array.from(e.target.files);if(!files.length)return;setUploading(true);
    const nf=[...(standaloneFiles||[])];
    for(const f of files){
      const dn=window.prompt("Name:",f.name.replace(/\.[^.]+$/,""))||f.name;
      const result=await processFileForUpload(f,showToast);
      if(result.warn)showToast(result.warn);
      try{
        if(result.multiPage&&result.files){
          for(let pi=0;pi<result.files.length;pi++){
            const pf=result.files[pi];
            const label=result.files.length>1?`${dn} — Page ${pi+1}`:dn;
            const fn=`${Date.now()}_${pf.name}`;const fr=storageRef(storage,`files/${fn}`);
            await uploadBytes(fr,pf);const url=await getDownloadURL(fr);
            nf.push({name:label,originalName:f.name,url,uploadedAt:new Date().toISOString(),converted:true});
          }
        } else {
          const uf=result.file;const fn=`${Date.now()}_${uf.name}`;
          const fr=storageRef(storage,`files/${fn}`);
          await uploadBytes(fr,uf);const url=await getDownloadURL(fr);
          nf.push({name:dn,originalName:f.name,url,uploadedAt:new Date().toISOString(),converted:!!result.wasConverted});
        }
      }catch(err){showToast("Failed");}
    }
    saveToFB("standaloneFiles",nf);setUploading(false);showToast("Uploaded");e.target.value="";
  };
    return(<div style={{minHeight:"100vh",background:t.bg,fontFamily:ff}}><Toast/>
      <OpsHomeBtn/>
      <Header title="All Files" subtitle={`${allAtts.length} files`} onBack={goHome} onHome={goHome}>
        <input ref={filesUploadRef} type="file" multiple onChange={handleDirectUpload} style={{display:"none"}}/>
        <button onClick={()=>filesUploadRef.current?.click()} disabled={uploading} style={{...primaryBtn,padding:"10px 16px",fontSize:"14px"}}><PlusIcon/> Upload</button>
      </Header>
      <div style={{padding:"20px",paddingBottom:"100px"}}>
        {allAtts.length===0?<div style={{textAlign:"center",padding:"48px",color:t.muted}}>No files yet.</div>:
        <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>{allAtts.map((att,i)=>(<div key={i} style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"10px",padding:"13px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{flex:1,minWidth:0}}><a href={att.url} onClick={e=>{e.preventDefault();setFileViewer(att);}} style={{fontSize:"13px",fontWeight:600,color:t.blue,textDecoration:"none",display:"flex",alignItems:"center",gap:"5px",marginBottom:"3px"}}><PaperclipIcon/><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{att.name}</span></a><div style={{fontSize:"11px",color:t.muted}}>{att.source}{att.members?" - "+att.members:""} - {att.date}</div></div>
          <div style={{display:"flex",gap:"2px",flexShrink:0}}><button onClick={()=>handleRenameFile(att)} style={{...ghostBtn,padding:"5px",color:t.blue}}><EditIcon/></button><button onClick={()=>handleDeleteFile(att)} style={{...ghostBtn,padding:"5px",color:t.danger}}><TrashIcon/></button></div>
        </div>))}</div>}
      </div>
    </div>);
  }

  // ── CREW VIEW ─────────────────────────────────────────────────────────────
  if(mode==="crew"){
    const allActive=activeCrew;
    return(<div style={{minHeight:"100vh",background:t.bg,fontFamily:ff}}><Toast/>
      <OpsHomeBtn/>
      <Header title="Icon Field Crews" subtitle={today} onBack={()=>goHome()} onHome={goHome}>
        <button onClick={()=>setMode("fieldnotes")} style={{...baseBtn,background:"rgba(34,211,238,.1)",border:`1px solid rgba(34,211,238,.3)`,color:t.cyan,padding:"7px 12px",fontSize:"12px",fontWeight:700}}>📝 Notes</button>
        <button onClick={()=>setShowMaterialsForm(true)} style={{...baseBtn,background:"rgba(245,158,11,.12)",border:`1px solid rgba(245,158,11,.3)`,color:t.amber,padding:"7px 12px",fontSize:"12px",fontWeight:700}}>🔧 Materials</button>
      </Header>
      <div style={{padding:"20px",paddingBottom:"100px"}}>
        <div style={{fontSize:"16px",fontWeight:700,color:t.text,marginBottom:"14px"}}>{"Today's Work Orders"}</div>
        {allActive.length===0
          ?<div style={{textAlign:"center",padding:"48px",color:t.muted}}>No active work orders for today</div>
          :<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
            {allActive.map((order,idx)=>(
              <button key={idx} onClick={()=>{
                const refId=order.referenceId||generateReferenceId(order);
                logConfirmation({orderId:order.referenceId||refId,refId,crewName:order.crewName,members:order.members||[]});
                logActivity({type:"order_viewed",who:(order.members||[]).join(", ")||order.crewName||"Crew",text:`${(order.members||[]).join(", ")||order.crewName||"Crew"} viewed Work Order ${refId}`,refId});
                setDocView(order);
              }} style={{...baseBtn,background:t.card,border:`1px solid ${t.line}`,padding:"18px",borderRadius:"14px",flexDirection:"column",alignItems:"flex-start",gap:"6px",color:t.text,width:"100%",textAlign:"left"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",width:"100%"}}>
                  <div style={{width:"4px",height:"40px",background:"linear-gradient(180deg,#E8192C,#FF6B35)",borderRadius:"2px",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"15px",fontWeight:800,color:t.text,marginBottom:"3px"}}>{order.members?.length>0?order.members.join(", "):order.crewName}</div>
                    {getJobsForOrder(order).map((j,i)=><div key={i} style={{fontSize:"12px",color:t.blue,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getJobsForOrder(order).length>1&&<span style={{fontWeight:700}}>Job {i+1}: </span>}{j.jobAddress}</div>)}
                    {order.customerName&&<div style={{fontSize:"11px",color:t.muted,marginTop:"2px"}}>{order.customerName}</div>}
                  </div>
                  <div style={{fontSize:"20px",flexShrink:0}}>📋</div>
                </div>
                <div style={{marginLeft:"12px",fontSize:"11px",fontWeight:700,color:"rgba(232,25,44,0.8)",textTransform:"uppercase",letterSpacing:"1px"}}>Tap to view work order →</div>
              </button>
            ))}
          </div>}
      </div>
    </div>);
  }

  // ── FIELD OPS ─────────────────────────────────────────────────────────────
  if(mode==="fieldops")return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:ff}}><Toast/>
      <OpsHomeBtn/>
      <Header title="Icon Operations" subtitle={today} onBack={()=>{setShowFieldForm(false);setEditingFieldOrder(null);goHome();}} onHome={goHome}>
        <button onClick={()=>setShowMaterialsForm(true)} style={{...baseBtn,background:"rgba(245,158,11,.12)",border:`1px solid rgba(245,158,11,.3)`,color:t.amber,padding:"7px 12px",fontSize:"12px",fontWeight:700}}>🔧 Materials</button>
        {!showFieldForm&&<button onClick={()=>{setFieldFormData({...emptyFieldOrder});setEditingFieldOrder(null);setShowFieldForm(true);}} style={{...primaryBtn,padding:"10px 16px",fontSize:"14px"}}><PlusIcon/> New</button>}
      </Header>
      <div style={{padding:"20px",paddingBottom:"100px"}}>
        {showFieldForm?(<div>
          <h2 style={{fontSize:"19px",color:t.text,margin:"0 0 18px",fontWeight:700}}>{editingFieldOrder!==null?"Edit":"New"} Field Order</h2>
          <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
            <div><label style={labelStyle}>Staff Member</label><div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>{FIELD_OPS_MEMBERS.map(n=>{const s=(fieldFormData.staffMember||[]).includes(n);return<button key={n} onClick={()=>toggleFieldMember(n)} style={{...baseBtn,padding:"8px 16px",borderRadius:"20px",fontSize:"13px",background:s?"rgba(167,139,250,.18)":t.card,color:s?t.purple:t.text,border:`1.5px solid ${s?"rgba(167,139,250,.45)":t.line}`,gap:"4px"}}>{s&&<CheckIcon/>}{n}</button>;})}</div></div>
            <div><label style={labelStyle}>Date</label><input type="date" value={fieldFormData.date} onChange={e=>setFieldFormData({...fieldFormData,date:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>{"Today's Tasks"}</label><BulletTextarea value={fieldFormData.todaysTasks||""} onChange={e=>setFieldFormData({...fieldFormData,todaysTasks:e.target.value})} placeholder="Enter tasks..." style={inputStyle}/></div>
            <div><label style={labelStyle}>Job Requests</label><BulletTextarea value={fieldFormData.jobRequests||""} onChange={e=>setFieldFormData({...fieldFormData,jobRequests:e.target.value})} placeholder="Enter requests..." style={inputStyle}/></div>
            <div><label style={labelStyle}>Attachments</label><input ref={fieldFileRef} type="file" multiple onChange={e=>handleUpload(e,fieldFormData,setFieldFormData)} style={{display:"none"}}/>
              <button onClick={()=>fieldFileRef.current?.click()} disabled={uploading} style={{...baseBtn,background:t.card,border:`1px solid ${t.line}`,color:t.text,padding:"12px",fontSize:"14px",width:"100%"}}><PaperclipIcon/> {uploading?"Uploading...":"Add Attachments"}</button>
              {fieldFormData.attachments?.length>0&&<div style={{marginTop:"8px",display:"flex",flexDirection:"column",gap:"5px"}}>{fieldFormData.attachments.map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:t.card,padding:"7px 12px",borderRadius:"8px",border:`1px solid ${t.line}`}}><span style={{fontSize:"13px",color:t.text}}>{a.name}</span><button onClick={()=>setFieldFormData({...fieldFormData,attachments:fieldFormData.attachments.filter((_,x)=>x!==i)})} style={{...ghostBtn,padding:"4px",color:t.danger}}><TrashIcon/></button></div>)}</div>}
            </div>
            <div style={{display:"flex",gap:"10px"}}><button onClick={()=>{setShowFieldForm(false);setEditingFieldOrder(null);}} style={{...baseBtn,flex:1,background:t.tag,border:`1px solid ${t.line}`,color:t.muted,padding:"14px"}}>Cancel</button><button onClick={saveField} style={{...primaryBtn,flex:2,justifyContent:"center"}}>{editingFieldOrder!==null?"Update":"Create"}</button></div>
          </div></div>):(<>
          <div style={{fontSize:"16px",fontWeight:700,color:t.text,marginBottom:"14px"}}>Active Orders</div>
          {activeField.length===0?<div style={{textAlign:"center",padding:"48px",color:t.muted}}>No active field orders.</div>:
          <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>{activeField.map((order)=>{const ri=fieldOrders.indexOf(order);return(<div key={ri} style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"12px",padding:"15px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
              <div style={{fontSize:"14px",fontWeight:700,color:t.purple}}>{(order.staffMember||[]).join(", ")||"Unassigned"}</div>
              <div style={{display:"flex",gap:"4px"}} className="no-print">
                <button onClick={()=>handlePrint(order)} style={{...ghostBtn,padding:"5px",color:t.muted}}><PrintIcon/></button>
                <button onClick={()=>setPinDialog({type:"editField",index:ri})} style={{...ghostBtn,padding:"5px",color:t.blue}}><EditIcon/></button>
                <button onClick={()=>setPinDialog({type:"deleteField",index:ri})} style={{...ghostBtn,padding:"5px",color:t.danger}}><TrashIcon/></button>
              </div>
            </div>
            <div style={{fontSize:"11px",color:t.muted,marginBottom:"6px",fontWeight:600,letterSpacing:".5px"}}>{order.date}</div>
            {order.todaysTasks&&<div style={{fontSize:"13px",color:t.text,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{renderBullet(order.todaysTasks)}</div>}
          </div>);})}
          </div>}
        </>)}
      </div>
      {pinDialog?.type==="editField"&&<PinDialog title="Manager PIN to Edit" onSuccess={()=>{const o=fieldOrders[pinDialog.index];setFieldFormData({...emptyFieldOrder,...o,staffMember:o.staffMember||[],attachments:o.attachments||[]});setEditingFieldOrder(pinDialog.index);setShowFieldForm(true);setPinDialog(null);}} onCancel={()=>setPinDialog(null)}/>}
      {pinDialog?.type==="deleteField"&&<PinDialog title="Manager PIN to Delete" onSuccess={()=>{deleteField(pinDialog.index);setPinDialog(null);}} onCancel={()=>setPinDialog(null)}/>}
    </div>
  );

  // ── MANAGE CREWS ──────────────────────────────────────────────────────────
  if(manageCrews){
    const allMemberNames=Array.from(new Set(crewNames.flatMap(c=>crews[c]||[]))).sort();
    return(<div style={{minHeight:"100vh",background:t.bg,fontFamily:ff}}><Toast/>
    <Header title="Manage Crew Rosters" onBack={()=>{setManageCrews(false);setEditingCrewName(null);setNewMemberName("");}} onHome={goHome}/>
    <div style={{padding:"20px",paddingBottom:"100px"}}>
      <div style={{marginBottom:"24px",background:t.card,border:`1px solid rgba(245,158,11,.25)`,borderRadius:"12px",padding:"16px"}}>
        <div style={{fontSize:"13px",fontWeight:700,color:t.amber,marginBottom:"4px"}}>📱 SMS Auto-Notify</div>
        <div style={{fontSize:"11px",color:t.muted,marginBottom:"14px",lineHeight:1.5}}>Add a phone number for each member. When a work order is saved or you tap the 📱 button on a card, the native SMS app opens for each member with a pre-filled message. Members without a number are silently skipped.</div>
        {allMemberNames.length===0?<div style={{fontSize:"12px",color:t.muted}}>No members yet. Add members to a crew below.</div>:
        <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>{allMemberNames.map(name=>(
          <div key={name} style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <span style={{flex:1,fontSize:"13px",color:t.text,fontWeight:600}}>{name}</span>
            <input type="tel" value={memberPhones[name]||""} onChange={e=>{const v=e.target.value;setMemberPhones(p=>({...p,[name]:v}));saveToFB(`memberPhones/${name}`,v);}} placeholder="(555) 555-5555" style={{...inputStyle,maxWidth:"180px",padding:"8px 12px",fontSize:"13px"}}/>
          </div>
        ))}</div>}
      </div>
      {crewNames.map(crew=>(<div key={crew} style={{marginBottom:"22px"}}>
      <div style={{fontSize:"13px",fontWeight:700,color:t.green,marginBottom:"10px",borderBottom:`1px solid ${t.line}`,paddingBottom:"7px",textTransform:"uppercase",letterSpacing:".5px"}}>{crew}</div>
      <div style={{display:"flex",flexDirection:"column",gap:"6px",marginBottom:"10px"}}>{(crews[crew]||[]).map((n,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:t.card,padding:"10px 14px",borderRadius:"8px",border:`1px solid ${t.line}`}}><span style={{fontSize:"14px",color:t.text}}>{n}</span><button onClick={()=>removeMember(crew,i)} style={{...ghostBtn,padding:"4px",color:t.danger}}><TrashIcon/></button></div>)}</div>
      {editingCrewName===crew?(<div style={{display:"flex",gap:"8px"}}><input value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} placeholder="Name" style={{...inputStyle,flex:1}} onKeyDown={e=>{if(e.key==="Enter")addMember(crew);}}/><button onClick={()=>addMember(crew)} style={{...primaryBtn,padding:"10px 16px",fontSize:"14px",justifyContent:"center"}}>Add</button><button onClick={()=>{setEditingCrewName(null);setNewMemberName("");}} style={{...ghostBtn,color:t.muted}}>Cancel</button></div>):<button onClick={()=>{setEditingCrewName(crew);setNewMemberName("");}} style={{...ghostBtn,color:t.green,fontSize:"13px",padding:"5px 0",gap:"4px"}}><PlusIcon/> Add Member</button>}
    </div>))}
    </div>
  </div>);
  }

  // ── ARCHIVE ───────────────────────────────────────────────────────────────
  if(showArchive){
    const lc=archiveSearch.trim().toLowerCase();
    const filteredArchive=lc?allArchived.filter(o=>{
      const fields=[o.crewName,(o.members||o.staffMember||[]).join(" "),o.referenceId,o.customerName,o.jobAddress,o.jobDescription,...(getJobsForOrder(o).flatMap(j=>[j.customerName,j.jobAddress,j.jobDescription,j.jobTreadName]))].filter(Boolean).join(" ").toLowerCase();
      return fields.includes(lc);
    }):allArchived;
    return(<div style={{minHeight:"100vh",background:t.bg,fontFamily:ff}}>
      <Header title="Archived Orders" onBack={()=>setShowArchive(false)} onHome={goHome}/>
      <div style={{padding:"20px",paddingBottom:"100px"}}>
        <div style={{position:"relative",marginBottom:"14px"}}>
          <input value={archiveSearch} onChange={e=>setArchiveSearch(e.target.value)} placeholder="Search archive — crew, member, address, ref ID..." style={{...inputStyle,paddingLeft:"38px"}}/>
          <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:t.muted,pointerEvents:"none"}}><SearchIcon/></span>
        </div>
        <div style={{fontSize:"12px",color:t.muted,marginBottom:"12px"}}>{filteredArchive.length} of {allArchived.length}</div>
        {filteredArchive.length===0?<div style={{textAlign:"center",padding:"48px",color:t.muted}}>{lc?"No matches.":"No archived orders."}</div>:
        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>{filteredArchive.map((order,idx)=>(<div key={idx} style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"12px",padding:"15px",opacity:0.78}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"7px",flexWrap:"wrap",gap:"6px"}}>
            <div style={{display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:"11px",background:order._type==="field"?"rgba(167,139,250,.15)":"rgba(74,222,128,.12)",color:order._type==="field"?t.purple:t.green,padding:"3px 10px",borderRadius:"20px",fontWeight:700,textTransform:"uppercase",letterSpacing:".5px"}}>{order._type==="field"?"Field Ops":order.crewName}</span>
              {order.referenceId&&<span style={{fontSize:"10px",background:"rgba(34,211,238,.12)",color:t.cyan,padding:"3px 8px",borderRadius:"6px",fontWeight:700,fontFamily:"monospace"}}>{order.referenceId}</span>}
            </div>
            <span style={{fontSize:"11px",color:t.muted}}>{order.date}</span>
          </div>
          <div style={{fontSize:"13px",fontWeight:600,color:t.text}}>{(order.members||order.staffMember||[]).join(", ")}</div>
          {order.jobAddress&&<div style={{fontSize:"12px",color:t.muted,marginTop:"2px"}}>{order.jobAddress}</div>}
          {!order.jobAddress&&getJobsForOrder(order)[0]?.jobAddress&&<div style={{fontSize:"12px",color:t.muted,marginTop:"2px"}}>{getJobsForOrder(order)[0].jobAddress}</div>}
        </div>))}</div>}
      </div>
    </div>);
  }

  // ── PIN SETTINGS ──────────────────────────────────────────────────────────
  if(showPinSettings)return(<div style={{minHeight:"100vh",background:t.bg,fontFamily:ff}}><Toast/>
    <Header title="PIN & Access Settings" onBack={()=>setShowPinSettings(false)} onHome={goHome}/>
    <div style={{padding:"20px",paddingBottom:"100px",maxWidth:"400px",display:"flex",flexDirection:"column",gap:"16px"}}>
      <div style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"14px",padding:"18px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:t.amber,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:"4px"}}>Manager PIN</div>
        <div style={{fontSize:"12px",color:t.muted,marginBottom:"12px"}}>Current: <strong style={{color:t.text}}>{managerPin}</strong></div>
        <label style={labelStyle}>New PIN</label>
        <input type="password" inputMode="numeric" value={newPin} onChange={e=>setNewPin(e.target.value)} placeholder="Enter new PIN" style={{...inputStyle,marginBottom:"12px"}}/>
        <button onClick={saveNewPin} style={{...primaryBtn,width:"100%",padding:"12px",justifyContent:"center"}}>Update Manager PIN</button>
      </div>
      <div style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"14px",padding:"18px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:t.green,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:"4px"}}>Crew PIN</div>
        <div style={{fontSize:"12px",color:t.muted,marginBottom:"12px"}}>Current: <strong style={{color:t.text}}>{crewPin||DEFAULT_CREW_PIN}</strong></div>
        <label style={labelStyle}>New Crew PIN</label>
        <input type="password" inputMode="numeric" value={newCrewPin} onChange={e=>setNewCrewPin(e.target.value)} placeholder="Enter new crew PIN" style={{...inputStyle,marginBottom:"12px"}}/>
        <button onClick={saveNewCrewPin} style={{...baseBtn,width:"100%",padding:"12px",justifyContent:"center",background:"linear-gradient(135deg,#16A34A,#4ADE80)",color:"#051009",fontWeight:700,fontSize:"14px",borderRadius:"10px"}}>Update Crew PIN</button>
      </div>
      <div style={{background:"rgba(167,139,250,.07)",border:"1.5px solid rgba(167,139,250,.2)",borderRadius:"14px",padding:"18px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:t.purple,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:"4px"}}>✨ AI Features</div>
        <div style={{fontSize:"12px",color:t.muted,marginBottom:"14px"}}>Manager-only. AI calls are proxied through /api/anthropic — set <code style={{background:t.tag,padding:"1px 5px",borderRadius:"4px",fontSize:"11px"}}>ANTHROPIC_API_KEY</code> in Vercel.</div>
        {[
          {k:"aiDescriptionGenerator",label:"Smart Job Description Generator",hint:"✨ button next to Job Description"},
          {k:"aiMaterialsSuggest",label:"Materials Auto-Suggest",hint:"✨ button next to Materials Required"},
          {k:"aiVoiceToOrder",label:"Voice → Work Order",hint:"🎤 mic in form header"}
        ].map(s=>{
          const on=!!aiSettings[s.k];
          return(
            <div key={s.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderTop:`1px solid ${t.line}`}}>
              <div style={{flex:1,minWidth:0,marginRight:"10px"}}>
                <div style={{fontSize:"13px",color:t.text,fontWeight:600}}>{s.label}</div>
                <div style={{fontSize:"11px",color:t.muted}}>{s.hint}</div>
              </div>
              <button type="button" onClick={()=>{const next={...aiSettings,[s.k]:!on};setAiSettings(next);saveToFB("settings/ai",{aiDescriptionGenerator:next.aiDescriptionGenerator,aiMaterialsSuggest:next.aiMaterialsSuggest,aiVoiceToOrder:next.aiVoiceToOrder});}} style={{width:"44px",height:"24px",borderRadius:"14px",background:on?t.purple:t.line,border:"none",position:"relative",cursor:"pointer",padding:0,flexShrink:0}}>
                <span style={{position:"absolute",top:"2px",left:on?"22px":"2px",width:"20px",height:"20px",background:"#fff",borderRadius:"50%",transition:"left .15s"}}/>
              </button>
            </div>
          );
        })}
      </div>
      <div style={{background:"rgba(244,63,94,.07)",border:"1.5px solid rgba(244,63,94,.18)",borderRadius:"14px",padding:"18px"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:t.danger,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:"4px"}}>Reset Device</div>
        <div style={{fontSize:"12px",color:t.muted,marginBottom:"12px"}}>Clear saved login on this device.</div>
        <button onClick={()=>{if(window.confirm("Sign out this device?")){localStorage.removeItem(AUTH_KEY);window.location.reload();}}} style={{...baseBtn,width:"100%",padding:"12px",background:t.danger,color:"#fff",fontSize:"14px",justifyContent:"center",fontWeight:700,borderRadius:"10px"}}>Sign Out This Device</button>
      </div>
    </div>
  </div>);

  if(mode==="subOrders")return(<SubOrderManager onBack={()=>setMode("manager")} onHome={goHome} activeJobs={activeJobs} showToast={showToast}/>);

  // ── MANAGER ───────────────────────────────────────────────────────────────
  return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:ff}}><Toast/>
      <OpsHomeBtn/>
      {deleteConfirm!==null&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}><div style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"16px",padding:"26px",maxWidth:"300px",width:"100%",textAlign:"center"}}><div style={{fontSize:"16px",fontWeight:700,marginBottom:"8px",color:t.text}}>Delete Order?</div><div style={{fontSize:"13px",color:t.muted,marginBottom:"22px"}}>{"This can't be undone."}</div><div style={{display:"flex",gap:"10px"}}><button onClick={()=>setDeleteConfirm(null)} style={{...baseBtn,flex:1,background:t.tag,color:t.muted,padding:"12px",border:`1px solid ${t.line}`}}>Cancel</button><button onClick={()=>deleteCrew(deleteConfirm)} style={{...baseBtn,flex:1,background:t.danger,color:"#fff",padding:"12px",fontWeight:700,borderRadius:"10px"}}>Delete</button></div></div></div>}
      {aiDescDialog&&<GenerateDescriptionDialog
        onUse={(text)=>{const ji=aiDescDialog.jobIdx;const nj=(formData.jobs||[]).map((j,i)=>i===ji?{...j,jobDescription:text}:j);setFormData({...formData,jobs:nj});}}
        onEditAndUse={(text)=>{const ji=aiDescDialog.jobIdx;const nj=(formData.jobs||[]).map((j,i)=>i===ji?{...j,jobDescription:text}:j);setFormData({...formData,jobs:nj});}}
        onClose={()=>setAiDescDialog(null)}
      />}
      {aiMatsDialog&&<SuggestMaterialsDialog
        jobDescription={aiMatsDialog.jobDescription}
        onUse={(text)=>{const ji=aiMatsDialog.jobIdx;const nj=(formData.jobs||[]).map((j,i)=>i===ji?{...j,materials:text}:j);setFormData({...formData,jobs:nj});}}
        onEditAndUse={(text)=>{const ji=aiMatsDialog.jobIdx;const nj=(formData.jobs||[]).map((j,i)=>i===ji?{...j,materials:text}:j);setFormData({...formData,jobs:nj});}}
        onClose={()=>setAiMatsDialog(null)}
      />}
      {aiVoiceDialog&&<VoiceToOrderDialog
        onApply={(fields)=>{
          const f={...formData};
          if(fields.crewName)f.crewName=fields.crewName;
          if(Array.isArray(fields.members)&&fields.members.length>0)f.members=fields.members;
          if(fields.date)f.date=fields.date;
          const j0={...(f.jobs?.[0]||{...emptyJob})};
          if(fields.customerName)j0.customerName=fields.customerName;
          if(fields.customerPhone)j0.customerPhone=fields.customerPhone;
          if(fields.jobAddress)j0.jobAddress=fields.jobAddress;
          if(fields.jobDescription)j0.jobDescription=fields.jobDescription;
          if(fields.materials)j0.materials=fields.materials;
          if(fields.specialNotes)j0.specialNotes=fields.specialNotes;
          f.jobs=[j0,...(f.jobs?.slice(1)||[])];
          setFormData(f);
        }}
        onClose={()=>setAiVoiceDialog(false)}
        showToast={showToast}
      />}
      <Header title="Manager" subtitle={today} onBack={()=>{setManagerAuth(false);goHome();}} onHome={goHome}>
        <button onClick={()=>setMode("subOrders")} style={{...baseBtn,background:t.tag,border:`1px solid ${t.line}`,color:t.text,padding:"7px 10px",fontSize:"12px",fontWeight:700}} title="Subcontractor Orders">👷 Subs</button>
        {!showForm&&<button onClick={()=>{setFormData({...emptyCrewOrder});setEditingOrder(null);setShowForm(true);}} style={{...primaryBtn,padding:"7px 12px",fontSize:"13px"}}><PlusIcon/> New</button>}
        <OverflowMenu items={[
          {icon:<ArchiveIcon/>,label:"Archive",onClick:()=>setShowArchive(true)},
          {icon:<LockIcon/>,label:"Change PIN",color:t.amber,onClick:()=>setShowPinSettings(true)},
          {icon:<KeyIcon/>,label:"Lock Box Codes",color:t.amber,onClick:()=>setMode("manageLockbox")},
          {icon:<SettingsIcon/>,label:"Manage Crews",onClick:()=>setManageCrews(true)},
        ]}/>
      </Header>
      <div style={{padding:"20px",paddingBottom:"100px"}}>
        {showForm?(<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"0 0 18px"}}>
            <h2 style={{fontSize:"19px",color:t.text,margin:0,fontWeight:700}}>{editingOrder!==null?"Edit":"New"} Work Order</h2>
            {aiSettings.aiVoiceToOrder&&<button onClick={()=>setAiVoiceDialog(true)} style={{...baseBtn,background:"rgba(167,139,250,.12)",border:"1px solid rgba(167,139,250,.3)",color:t.purple,padding:"8px 14px",fontSize:"12px",fontWeight:700,borderRadius:"8px"}}>🎤 Voice Input</button>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>

            {/* CREW + DATE (shared) */}
            <div><label style={labelStyle}>Crew</label><select value={formData.crewName} onChange={e=>setFormData({...formData,crewName:e.target.value,members:[]})} style={{...inputStyle,appearance:"none",cursor:"pointer"}}><option value="">Select a crew...</option>{crewNames.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            {formData.crewName&&(crews[formData.crewName]||[]).length>0&&<div><label style={labelStyle}>Assign Members</label><div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>{(crews[formData.crewName]||[]).map(n=>{const s=(formData.members||[]).includes(n);return<button key={n} onClick={()=>toggleMember(n)} style={{...baseBtn,padding:"8px 14px",borderRadius:"20px",fontSize:"13px",background:s?t.blue:t.tag,color:s?"#fff":t.text,border:`1px solid ${s?t.blue:t.line}`,gap:"4px"}}>{s&&<CheckIcon/>}{n}</button>;})}</div></div>}
            <div><label style={labelStyle}>Date</label><input type="date" value={formData.date} onChange={e=>setFormData({...formData,date:e.target.value})} style={inputStyle}/></div>

            {/* PER-JOB SECTIONS */}
            {(formData.jobs||[{...emptyJob}]).map((job,ji)=>{
              const jobColors2=["rgba(33,150,243,0.08)","rgba(156,39,176,0.08)","rgba(255,107,53,0.08)"];
              const jobBorders=["rgba(33,150,243,0.3)","rgba(156,39,176,0.3)","rgba(255,107,53,0.3)"];
              const jobAccents=["#2196F3","#9C27B0","#FF6B35"];
              const updateJob=(field,val)=>{const nj=(formData.jobs||[]).map((j,i)=>i===ji?{...j,[field]:val}:j);setFormData({...formData,jobs:nj});};
              const updateJobAtts=(atts)=>{const nj=(formData.jobs||[]).map((j,i)=>i===ji?{...j,attachments:atts}:j);setFormData({...formData,jobs:nj});};
              return(
                <div key={ji} style={{background:jobColors2[ji],border:`1.5px solid ${jobBorders[ji]}`,borderRadius:"14px",padding:"16px",display:"flex",flexDirection:"column",gap:"12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:"13px",fontWeight:800,color:jobAccents[ji],textTransform:"uppercase",letterSpacing:"1px"}}>Job #{ji+1}</div>
                    {ji>0&&<button onClick={()=>{const nj=(formData.jobs||[]).filter((_,i)=>i!==ji);setFormData({...formData,jobs:nj});}} style={{...ghostBtn,padding:"4px 10px",fontSize:"12px",color:t.danger,border:`1px solid ${t.danger}`,borderRadius:"8px"}}>✕ Remove</button>}
                  </div>

                  {/* Job selector from Active Jobs */}
                  <div>
                    <label style={labelStyle}>Select Active Job</label>
                    <select value={job.jobTreadName||""} onChange={e=>{
                      const sel=(activeJobs||[]).find(j=>j.name===e.target.value);
                      if(sel){const nj=(formData.jobs||[]).map((jb,i)=>i===ji?{...jb,jobTreadName:sel.name,customerName:(sel.customerName||"").toUpperCase(),jobAddress:sel.address||""}:jb);setFormData({...formData,jobs:nj});}
                      else{const nj=(formData.jobs||[]).map((jb,i)=>i===ji?{...jb,jobTreadName:"",customerName:"",jobAddress:""}:jb);setFormData({...formData,jobs:nj});}
                    }} style={{...inputStyle,appearance:"none",cursor:"pointer"}}>
                      <option value="">— Select a job or enter manually below —</option>
                      {(activeJobs||[]).map((aj,ai)=><option key={ai} value={aj.name}>{aj.name}{aj.customerName?` · ${aj.customerName}`:""}</option>)}
                    </select>
                  </div>
                  <div style={{display:"flex",gap:"10px"}}>
                    <div style={{flex:1}}><label style={labelStyle}>Customer Name</label><input value={job.customerName||""} onChange={e=>updateJob("customerName",e.target.value.toUpperCase())} placeholder="Customer name" style={inputStyle}/></div>
                    <div style={{flex:1}}><label style={labelStyle}>Customer Phone</label><input type="tel" value={job.customerPhone||""} onChange={e=>updateJob("customerPhone",e.target.value)} placeholder="(555) 555-5555" style={inputStyle}/></div>
                  </div>
                  <div><label style={labelStyle}>Job Address {ji===0&&<span style={{color:t.danger}}>*</span>}</label><AddressInput value={job.jobAddress||""} onChange={e=>updateJob("jobAddress",e.target.value)} style={inputStyle}/><div style={{fontSize:"11px",color:t.muted,marginTop:"4px"}}>Start typing to search or auto-filled from job selection above</div></div>
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                      <label style={{...labelStyle,marginBottom:0}}>Job Description</label>
                      {aiSettings.aiDescriptionGenerator&&<AIPillButton label="Generate" onClick={()=>setAiDescDialog({jobIdx:ji})}/>}
                    </div>
                    <BulletTextarea value={job.jobDescription||""} onChange={e=>updateJob("jobDescription",e.target.value)} placeholder="Describe the work... (Enter for bullets)" style={inputStyle}/>
                  </div>
                  <div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                      <label style={{...labelStyle,marginBottom:0}}>Materials Required</label>
                      {aiSettings.aiMaterialsSuggest&&(job.jobDescription||"").trim().length>0&&<AIPillButton label="Suggest Materials" onClick={()=>setAiMatsDialog({jobIdx:ji,jobDescription:job.jobDescription})}/>}
                    </div>
                    <BulletTextarea value={job.materials||""} onChange={e=>updateJob("materials",e.target.value)} placeholder="List materials... (Enter for bullets)" style={inputStyle}/>
                  </div>
                  <div><label style={labelStyle}>Special Notes</label><BulletTextarea value={job.specialNotes||""} onChange={e=>updateJob("specialNotes",e.target.value)} placeholder="Any special instructions..." style={inputStyle}/></div>
                  <div>
                    <label style={labelStyle}>Attachments</label>
                    <input type="file" multiple style={{display:"none"}} id={`jobfile-${ji}`} onChange={async e=>{
                      const files=Array.from(e.target.files);if(!files.length)return;setUploading(true);
                      const atts=[...(job.attachments||[])];
                      for(const f of files){const dn=window.prompt("Name this attachment:",f.name.replace(/\.[^.]+$/,""))||f.name;
                        const result=await processFileForUpload(f,showToast);if(result.warn)showToast(result.warn);
                        try{if(result.multiPage&&result.files){for(let pi=0;pi<result.files.length;pi++){const pf=result.files[pi];const label=result.files.length>1?`${dn} — Page ${pi+1}`:dn;const fn=`${Date.now()}_${pf.name}`;const fr=storageRef(storage,`attachments/${fn}`);await uploadBytes(fr,pf);const url=await getDownloadURL(fr);atts.push({name:label,originalName:f.name,url,uploadedAt:new Date().toISOString(),converted:true});}}else{const uf=result.file;const fn=`${Date.now()}_${uf.name}`;const fr=storageRef(storage,`attachments/${fn}`);await uploadBytes(fr,uf);const url=await getDownloadURL(fr);atts.push({name:dn,originalName:f.name,url,uploadedAt:new Date().toISOString(),converted:!!result.wasConverted});}}catch(err){showToast("Upload failed");}}
                      updateJobAtts(atts);setUploading(false);showToast(`${files.length} file(s) uploaded`);e.target.value="";
                    }}/>
                    <button onClick={()=>document.getElementById(`jobfile-${ji}`)?.click()} disabled={uploading} style={{...baseBtn,background:t.tag,border:`1px solid ${t.line}`,color:t.text,padding:"11px 16px",fontSize:"14px",width:"100%"}}><PaperclipIcon/> {uploading?"Uploading...":"Add Attachments"}</button>
                    {(job.attachments||[]).length>0&&<div style={{marginTop:"8px",display:"flex",flexDirection:"column",gap:"6px"}}>{(job.attachments||[]).map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:t.card,padding:"8px 12px",borderRadius:"8px"}}><span style={{fontSize:"13px",color:t.text}}><PaperclipIcon/> {a.name}</span><button onClick={()=>updateJobAtts((job.attachments||[]).filter((_,x)=>x!==i))} style={{...ghostBtn,padding:"4px",color:t.danger}}><TrashIcon/></button></div>)}</div>}
                  </div>
                </div>
              );
            })}

            {/* ADD JOB BUTTON */}
            {(formData.jobs||[]).length<3&&<button onClick={()=>setFormData({...formData,jobs:[...(formData.jobs||[]),{...emptyJob}]})} style={{...baseBtn,background:"transparent",border:`2px dashed ${t.line}`,color:t.muted,padding:"14px",width:"100%",borderRadius:"12px",fontSize:"13px",fontWeight:700}}>+ Add Job #{(formData.jobs||[]).length+1} Work Order</button>}

            {/* ── RECURRING ── */}
            <div style={{background:"rgba(167,139,250,.05)",border:"1.5px solid rgba(167,139,250,.18)",borderRadius:"12px",padding:"16px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:formData.recurring?.enabled?"14px":"0"}}>
                <div>
                  <div style={{fontSize:"13px",fontWeight:700,color:t.purple,marginBottom:"3px"}}>🔁 Recurring Work Order</div>
                  <div style={{fontSize:"11px",color:t.muted}}>Auto-generate this order on a schedule</div>
                </div>
                <button type="button" onClick={()=>setFormData(f=>({...f,recurring:{...(f.recurring||{frequency:"Weekly",until:""}),enabled:!(f.recurring?.enabled)}}))}
                  style={{width:"44px",height:"24px",borderRadius:"14px",background:formData.recurring?.enabled?t.purple:t.line,border:"none",position:"relative",cursor:"pointer",padding:0,flexShrink:0}}>
                  <span style={{position:"absolute",top:"2px",left:formData.recurring?.enabled?"22px":"2px",width:"20px",height:"20px",background:"#fff",borderRadius:"50%",transition:"left .15s"}}/>
                </button>
              </div>
              {formData.recurring?.enabled&&<div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                <div>
                  <label style={labelStyle}>Frequency</label>
                  <select value={formData.recurring?.frequency||"Weekly"} onChange={e=>setFormData(f=>({...f,recurring:{...f.recurring,frequency:e.target.value}}))} style={{...inputStyle,appearance:"none",cursor:"pointer"}}>
                    {FREQUENCIES.map(f=><option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Recurring Until</label>
                  <MiniCalendar value={formData.recurring?.until||""} onChange={v=>setFormData(f=>({...f,recurring:{...f.recurring,until:v}}))} minDate={formData.date}/>
                  <div style={{fontSize:"11px",color:t.muted,marginTop:"5px"}}>Stops auto-generating after this date. Leave blank for no end.</div>
                </div>
              </div>}
            </div>

            <div style={{display:"flex",gap:"10px"}}><button onClick={()=>{setShowForm(false);setEditingOrder(null);}} style={{...baseBtn,flex:1,background:t.tag,border:`1px solid ${t.line}`,color:t.muted,padding:"14px"}}>Cancel</button><button onClick={saveCrew} style={{...primaryBtn,flex:2,justifyContent:"center"}}>{editingOrder!==null?"Update":"Create Order"}</button></div>
          </div></div>):(<>
          {/* TABS: Today / Recurring / History */}
          <div style={{display:"flex",gap:"6px",marginBottom:"14px",borderBottom:`1px solid ${t.line}`,overflowX:"auto"}}>
            {[
              {k:"today",label:"Today"},
              {k:"recurring",label:"🔁 Recurring"},
              {k:"materials",label:"🔧 Materials",badge:Object.values(materialsRequests||{}).filter(r=>r.status==="pending").length},
              {k:"history",label:"📜 History",badge:unreadActivity}
            ].map(tab=>(
              <button key={tab.k} onClick={()=>{setMgrTab(tab.k);if(tab.k==="history"){const n={...lastSeen,managerHistory:new Date().toISOString()};setLastSeen(n);try{localStorage.setItem("wo-seen",JSON.stringify(n));}catch{}}}} style={{padding:"10px 14px",border:"none",background:"transparent",fontSize:"13px",fontWeight:700,color:mgrTab===tab.k?t.blue:t.muted,borderBottom:mgrTab===tab.k?`2px solid ${t.blue}`:"2px solid transparent",cursor:"pointer",fontFamily:ff,marginBottom:"-1px",position:"relative",whiteSpace:"nowrap"}}>{tab.label}{tab.badge>0&&<span style={{marginLeft:"6px",fontSize:"10px",background:t.danger,color:"#fff",padding:"1px 6px",borderRadius:"10px",fontWeight:800}}>{tab.badge}</span>}</button>
            ))}
          </div>

          {mgrTab==="today"&&(()=>{
            const lc=mgrSearch.trim().toLowerCase();
            const matches=(o)=>{
              if(!lc)return true;
              const fields=[o.crewName,(o.members||[]).join(" "),o.referenceId,...(getJobsForOrder(o).flatMap(j=>[j.customerName,j.jobAddress,j.jobDescription,j.jobTreadName]))].filter(Boolean).join(" ").toLowerCase();
              return fields.includes(lc);
            };
            const inFilter=(o)=>{
              if(mgrFilter==="all")return true;
              if(mgrFilter==="today")return o.date===todayStr;
              if(mgrFilter==="week"){
                const od=new Date(o.date+"T00:00:00");const now=new Date();const diff=(now-od)/86400000;
                return diff>=-1&&diff<=7;
              }
              if(mgrFilter.startsWith("crew:"))return o.crewName===mgrFilter.slice(5);
              return true;
            };
            const filtered=activeCrew.filter(o=>matches(o)&&inFilter(o));
            return(<>
              {/* Search bar */}
              <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
                <div style={{flex:1,position:"relative"}}>
                  <input value={mgrSearch} onChange={e=>setMgrSearch(e.target.value)} placeholder="Search crew, member, address, ref ID..." style={{...inputStyle,paddingLeft:"38px"}}/>
                  <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:t.muted,pointerEvents:"none"}}><SearchIcon/></span>
                </div>
              </div>
              <div style={{display:"flex",gap:"6px",marginBottom:"14px",flexWrap:"wrap",alignItems:"center"}}>
                {[{k:"today",label:"Today"},{k:"week",label:"This Week"},{k:"all",label:"All"}].map(p=>(
                  <button key={p.k} onClick={()=>setMgrFilter(p.k)} style={{...baseBtn,padding:"6px 12px",fontSize:"12px",borderRadius:"20px",background:mgrFilter===p.k?t.blue:t.tag,color:mgrFilter===p.k?"#fff":t.text,border:`1px solid ${mgrFilter===p.k?t.blue:t.line}`}}>{p.label}</button>
                ))}
                <select value={mgrFilter.startsWith("crew:")?mgrFilter:""} onChange={e=>setMgrFilter(e.target.value?`crew:${e.target.value}`:"today")} style={{padding:"6px 10px",fontSize:"12px",borderRadius:"20px",background:mgrFilter.startsWith("crew:")?t.blue:t.tag,color:mgrFilter.startsWith("crew:")?"#fff":t.text,border:`1px solid ${mgrFilter.startsWith("crew:")?t.blue:t.line}`,fontFamily:ff,cursor:"pointer"}}>
                  <option value="">By Crew…</option>
                  {crewNames.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{fontSize:"12px",color:t.muted,marginBottom:"14px",fontWeight:600}}>{filtered.length} {filtered.length===1?"order":"orders"}</div>
              {filtered.length===0?<div style={{textAlign:"center",padding:"48px",color:t.muted}}><div>No matching work orders</div><div style={{fontSize:"12px",marginTop:"5px"}}>Try a different search or filter</div></div>:
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>{filtered.map(order=>{const ri=orders.indexOf(order);return(<div key={ri} style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"12px",padding:"15px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"7px"}}>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"6px",alignItems:"center"}}>
                    <span style={{fontSize:"11px",background:"rgba(74,222,128,.12)",color:t.green,padding:"3px 10px",borderRadius:"20px",fontWeight:700,textTransform:"uppercase",letterSpacing:".5px"}}>{order.crewName}</span>
                    {order.referenceId&&<span style={{fontSize:"10px",background:"rgba(34,211,238,.12)",color:t.cyan,padding:"3px 8px",borderRadius:"6px",fontWeight:700,fontFamily:"monospace",letterSpacing:".5px"}}>{order.referenceId}</span>}
                    {order.recurring?.enabled&&<span style={{fontSize:"10px",background:"rgba(167,139,250,.15)",color:t.purple,padding:"3px 8px",borderRadius:"6px",fontWeight:700}}>🔁 {order.recurring.frequency}</span>}
                    {getJobsForOrder(order).length>1&&<span style={{fontSize:"11px",background:"rgba(232,25,44,0.15)",color:t.danger,border:`1px solid ${t.danger}`,padding:"2px 8px",borderRadius:"20px",fontWeight:700}}>{getJobsForOrder(order).length} Jobs</span>}
                  </div>
                  <div style={{display:"flex",gap:"3px"}}>
                    <button onClick={()=>{const c=triggerCrewSms(order);showToast(c===0?"No phone numbers stored for crew":`Re-notifying ${c} crew member${c===1?"":"s"}`);}} style={{...ghostBtn,padding:"5px",color:t.green}} title="📱 Re-notify Crew"><PhoneIcon/></button>
                    <button onClick={()=>handlePrint(order)} style={{...ghostBtn,padding:"5px",color:t.muted}}><PrintIcon/></button>
                    <button onClick={()=>setDocView(order)} style={{...ghostBtn,padding:"5px",color:t.cyan}} title="View as Document"><svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></button>
                    <button onClick={()=>{setFormData({...emptyCrewOrder,...order,members:order.members||[],jobs:getJobsForOrder(order),recurring:order.recurring||{enabled:false,frequency:"Weekly",until:""}});setEditingOrder(ri);setShowForm(true);}} style={{...ghostBtn,padding:"5px",color:t.blue}}><EditIcon/></button>
                    <button onClick={()=>setDeleteConfirm(ri)} style={{...ghostBtn,padding:"5px",color:t.danger}}><TrashIcon/></button>
                  </div>
                </div>
                {order.members?.length>0&&<div style={{fontSize:"13px",fontWeight:700,color:t.text,marginBottom:"3px"}}>{order.members.join(", ")}</div>}
                <div style={{fontSize:"12px",color:t.blue,marginBottom:"3px"}}>{getJobsForOrder(order).map((j,i)=><span key={i} style={{display:"block"}}>{getJobsForOrder(order).length>1&&<span style={{fontWeight:700}}>J{i+1}: </span>}{j.jobAddress}</span>)}</div>
                {order.date!==todayStr&&<div style={{fontSize:"11px",color:t.muted,marginBottom:"2px"}}>{order.date}</div>}
                {order.customerName&&<div style={{fontSize:"12px",color:t.muted,marginBottom:"2px"}}>{order.customerName}{order.jobTreadName&&<span style={{color:t.muted,fontSize:"11px"}}> · {order.jobTreadName}</span>}</div>}
                <div style={{fontSize:"12px",color:t.muted,lineHeight:1.5}}>{getJobsForOrder(order)[0]?.jobDescription?(getJobsForOrder(order)[0].jobDescription.length>100?getJobsForOrder(order)[0].jobDescription.slice(0,100)+"...":getJobsForOrder(order)[0].jobDescription):"No description"}</div>
              </div>);})}
              </div>}
            </>);
          })()}

          {mgrTab==="recurring"&&(()=>{
            const tpls=Object.values(recurringTemplates||{}).filter(tpl=>!tpl.stopped&&tpl.recurring?.frequency);
            const generateNow=(tpl)=>{
              const dateToUse=recurringTodayStr();
              const newOrder=orderFromTemplate({...tpl},dateToUse,generateReferenceId);
              newOrder.lastModified=new Date().toISOString();
              saveToFB("orders",[...orders,newOrder]);
              const nd=nextDate(dateToUse,tpl.recurring?.frequency);
              saveToFB(`recurringTemplates/${tpl.id}`,{...tpl,lastGeneratedDate:dateToUse,nextScheduledDate:nd,lastModified:newOrder.lastModified});
              logActivity({type:"recurring_generated",who:"Manager",text:`Manually generated ${newOrder.referenceId} from recurring template`,refId:newOrder.referenceId});
              showToast(`Generated ${newOrder.referenceId}`);
            };
            const stopRecurring=(tpl)=>{
              if(!window.confirm("Stop this recurring template? Existing orders will not be deleted."))return;
              saveToFB(`recurringTemplates/${tpl.id}`,{...tpl,stopped:true,lastModified:new Date().toISOString()});
              showToast("Recurring stopped");
            };
            return(<div>
              <div style={{fontSize:"17px",fontWeight:700,color:t.text,marginBottom:"4px"}}>Recurring Templates</div>
              <div style={{fontSize:"12px",color:t.muted,marginBottom:"14px",fontWeight:600}}>{tpls.length} active template{tpls.length===1?"":"s"}</div>
              {tpls.length===0?<div style={{textAlign:"center",padding:"48px",color:t.muted}}><div>No recurring templates yet</div><div style={{fontSize:"12px",marginTop:"5px"}}>Toggle "Recurring" when creating a work order</div></div>:
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>{tpls.map(tpl=>{
                const firstJob=(tpl.jobs||[])[0]||{};
                return(<div key={tpl.id} style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"12px",padding:"15px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px",flexWrap:"wrap",gap:"6px"}}>
                    <div style={{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{fontSize:"11px",background:"rgba(74,222,128,.12)",color:t.green,padding:"3px 10px",borderRadius:"20px",fontWeight:700}}>{tpl.crewName}</span>
                      <span style={{fontSize:"10px",background:"rgba(167,139,250,.15)",color:t.purple,padding:"3px 8px",borderRadius:"6px",fontWeight:700}}>🔁 {tpl.recurring?.frequency}</span>
                    </div>
                  </div>
                  {(tpl.members||[]).length>0&&<div style={{fontSize:"13px",fontWeight:700,color:t.text,marginBottom:"3px"}}>{(tpl.members||[]).join(", ")}</div>}
                  <div style={{fontSize:"12px",color:t.blue,marginBottom:"3px"}}>{firstJob.jobAddress||""}</div>
                  {firstJob.customerName&&<div style={{fontSize:"12px",color:t.muted,marginBottom:"3px"}}>{firstJob.customerName}</div>}
                  <div style={{fontSize:"11px",color:t.muted,marginBottom:"10px"}}>
                    Next: <span style={{color:t.text,fontWeight:600}}>{tpl.nextScheduledDate||"—"}</span>
                    {tpl.recurring?.until&&<span> · Until: {tpl.recurring.until}</span>}
                  </div>
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                    <button onClick={()=>generateNow(tpl)} style={{...baseBtn,background:t.blue,color:"#fff",padding:"8px 14px",fontSize:"12px",borderRadius:"8px",fontWeight:700}}>⚡ Generate Now</button>
                    <button onClick={()=>stopRecurring(tpl)} style={{...baseBtn,background:"transparent",border:`1px solid ${t.danger}`,color:t.danger,padding:"8px 14px",fontSize:"12px",borderRadius:"8px",fontWeight:700}}>⏹ Stop Recurring</button>
                  </div>
                </div>);
              })}</div>}
            </div>);
          })()}

          {mgrTab==="materials"&&(()=>{
            const list=Object.values(materialsRequests||{}).sort((a,b)=>(b.submittedAt||"").localeCompare(a.submittedAt||""));
            return(<div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
                <div style={{fontSize:"17px",fontWeight:700,color:t.text}}>Materials Requests</div>
                <button onClick={()=>setShowMaterialsForm(true)} style={{...baseBtn,background:t.amber,color:"#1F2329",padding:"8px 14px",fontSize:"12px",fontWeight:700,borderRadius:"8px"}}>+ New Request</button>
              </div>
              {list.length===0?<div style={{textAlign:"center",padding:"48px",color:t.muted}}>No materials requests yet</div>:
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>{list.map(r=>(
                <button key={r.id} onClick={()=>setMaterialsDetail(r.id)} style={{...baseBtn,background:t.card,border:`1px solid ${t.line}`,padding:"15px",borderRadius:"12px",flexDirection:"column",alignItems:"flex-start",gap:"6px",color:t.text,width:"100%",textAlign:"left"}}>
                  <div style={{display:"flex",justifyContent:"space-between",width:"100%",alignItems:"center",flexWrap:"wrap",gap:"6px"}}>
                    <div style={{display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{fontSize:"11px",background:"rgba(245,158,11,.15)",color:t.amber,padding:"3px 10px",borderRadius:"20px",fontWeight:700}}>{r.requestedBy||"Crew"}</span>
                      {r.status==="approved"&&<span style={{fontSize:"10px",background:"rgba(74,222,128,.15)",color:t.green,padding:"3px 8px",borderRadius:"6px",fontWeight:700}}>✓ Approved</span>}
                      {r.status==="pending"&&<span style={{fontSize:"10px",background:"rgba(244,63,94,.12)",color:t.danger,padding:"3px 8px",borderRadius:"6px",fontWeight:700}}>● Pending</span>}
                      {r.aiGeneratedList&&<span style={{fontSize:"10px",background:"rgba(167,139,250,.15)",color:t.purple,padding:"3px 8px",borderRadius:"6px",fontWeight:700}}>✨ AI ready</span>}
                    </div>
                    <span style={{fontSize:"11px",color:t.muted}}>{(r.submittedAt||"").split("T")[0]}</span>
                  </div>
                  <div style={{fontSize:"13px",fontWeight:600,color:t.text}}>{r.jobName||"—"} · {(r.lineItems||[]).length} item{(r.lineItems||[]).length===1?"":"s"}</div>
                  {r.overallNotes&&<div style={{fontSize:"12px",color:t.muted,lineHeight:1.4}}>{r.overallNotes.length>120?r.overallNotes.slice(0,120)+"…":r.overallNotes}</div>}
                </button>
              ))}</div>}
            </div>);
          })()}

          {mgrTab==="history"&&(()=>{
            const yesterday=(()=>{const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().split("T")[0];})();
            const ySummary=dailySummaries[yesterday];
            const findOrderByRef=refId=>(orders||[]).find(o=>o.referenceId===refId);
            const extractDate=text=>{const m=(text||"").match(/\d{4}-\d{2}-\d{2}/);return m?m[0]:null;};
            const handleActivityClick=e=>{
              if(!e||!e.type)return;
              if(e.type==="order_created"||e.type==="order_viewed"||e.type==="recurring_generated"){
                const found=findOrderByRef(e.refId);
                if(found)setDocView(found);
                else showToast("This order is no longer available");
                return;
              }
              if(e.type==="field_note"){setMode("fieldnotes");return;}
              if(e.type==="materials_request"){
                if(e.materialsId&&materialsRequests[e.materialsId])setMaterialsDetail(e.materialsId);
                else showToast("This order is no longer available");
                return;
              }
              if(e.type&&e.type.startsWith("sub_order")){setMode("subOrders");return;}
              if(e.type==="summary"){setExpandedSummaries(p=>({...p,[e.id]:!p[e.id]}));return;}
            };
            return(<div>
              <style>{`.history-row{transition:background 0.15s ease}.history-row:hover{background:${t.nav} !important}.history-row:active{background:${t.tag} !important;transform:scale(0.997)}.summary-card:hover{background:rgba(34,211,238,.09) !important}.summary-card:active{transform:scale(0.997)}`}</style>
              {/* Daily summary card — clickable, toggles inline expansion */}
              {ySummary&&<div className="summary-card" onClick={()=>setSummaryCardOpen(o=>!o)} style={{background:"rgba(34,211,238,.05)",border:"1.5px solid rgba(34,211,238,.2)",borderRadius:"12px",padding:"16px",marginBottom:"16px",cursor:"pointer",transition:"background 0.15s ease"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"10px"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"11px",fontWeight:700,color:t.cyan,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:"6px"}}>📊 Yesterday — {ySummary.date}</div>
                    <div style={{fontSize:"14px",color:t.text,lineHeight:1.5}}>{ySummary.text}</div>
                  </div>
                  <span style={{fontSize:"18px",color:t.cyan,flexShrink:0,transform:summaryCardOpen?"rotate(90deg)":"rotate(0deg)",transition:"transform 0.18s ease"}}>→</span>
                </div>
                {summaryCardOpen&&<div style={{marginTop:"12px",paddingTop:"12px",borderTop:"1px solid rgba(34,211,238,.2)",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:"10px"}}>
                  <div><div style={{fontSize:"10px",fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"3px"}}>Orders</div><div style={{fontSize:"18px",fontWeight:700,color:t.text}}>{ySummary.ordersCount||0}</div></div>
                  <div><div style={{fontSize:"10px",fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"3px"}}>Crews</div><div style={{fontSize:"18px",fontWeight:700,color:t.text}}>{ySummary.crewCount||0}</div></div>
                  <div><div style={{fontSize:"10px",fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"3px"}}>Field Notes</div><div style={{fontSize:"18px",fontWeight:700,color:t.text}}>{ySummary.fieldNotesCount||0}</div></div>
                  <div><div style={{fontSize:"10px",fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"3px"}}>Materials</div><div style={{fontSize:"18px",fontWeight:700,color:t.text}}>{ySummary.materialsCount||0}</div></div>
                </div>}
              </div>}
              <div style={{fontSize:"17px",fontWeight:700,color:t.text,marginBottom:"4px"}}>Activity Log</div>
              <div style={{fontSize:"12px",color:t.muted,marginBottom:"14px",fontWeight:600}}>{activityEntries.length} event{activityEntries.length===1?"":"s"}</div>
              {activityEntries.length===0?<div style={{textAlign:"center",padding:"48px",color:t.muted}}>No activity yet</div>:
              <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>{activityEntries.slice(0,200).map(e=>{
                const d=new Date(e.ts);const time=d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});const day=d.toLocaleDateString([],{month:"short",day:"numeric"});
                const isExpanded=e.type==="summary"&&expandedSummaries[e.id];
                const summaryDate=e.type==="summary"?extractDate(e.text):null;
                const summaryData=summaryDate?dailySummaries[summaryDate]:null;
                return(<div key={e.id} className="history-row" onClick={()=>handleActivityClick(e)} style={{background:t.card,border:`1px solid ${t.line}`,borderRadius:"10px",padding:"10px 14px",display:"flex",alignItems:"flex-start",gap:"10px",cursor:"pointer"}}>
                  <div style={{fontSize:"16px",flexShrink:0}}>{activityIcon(e.type)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"13px",color:t.text,lineHeight:1.4,whiteSpace:isExpanded?"pre-wrap":"normal"}}>{e.text}</div>
                    <div style={{fontSize:"11px",color:t.muted,marginTop:"2px"}}>{day} · {time}{e.who?` · ${e.who}`:""}</div>
                    {isExpanded&&summaryData&&<div style={{marginTop:"10px",paddingTop:"10px",borderTop:`1px solid ${t.line}`,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:"8px"}}>
                      <div><div style={{fontSize:"10px",color:t.muted,textTransform:"uppercase",letterSpacing:"1px"}}>Orders</div><div style={{fontSize:"15px",fontWeight:700,color:t.text}}>{summaryData.ordersCount||0}</div></div>
                      <div><div style={{fontSize:"10px",color:t.muted,textTransform:"uppercase",letterSpacing:"1px"}}>Crews</div><div style={{fontSize:"15px",fontWeight:700,color:t.text}}>{summaryData.crewCount||0}</div></div>
                      <div><div style={{fontSize:"10px",color:t.muted,textTransform:"uppercase",letterSpacing:"1px"}}>Notes</div><div style={{fontSize:"15px",fontWeight:700,color:t.text}}>{summaryData.fieldNotesCount||0}</div></div>
                      <div><div style={{fontSize:"10px",color:t.muted,textTransform:"uppercase",letterSpacing:"1px"}}>Materials</div><div style={{fontSize:"15px",fontWeight:700,color:t.text}}>{summaryData.materialsCount||0}</div></div>
                    </div>}
                  </div>
                  <span style={{fontSize:"15px",color:t.muted,flexShrink:0,alignSelf:"center",transform:isExpanded?"rotate(90deg)":"rotate(0deg)",transition:"transform 0.18s ease"}}>→</span>
                </div>);
              })}</div>}
            </div>);
          })()}
        </>)}
      </div>
    </div>
  );
}
