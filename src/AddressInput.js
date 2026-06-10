import React, { useState, useEffect, useCallback, useRef } from "react";

const GOOGLE_API_KEY = "AIzaSyDP9N998QacTADs3UaDYBohltD3rfflMmE";

const t = { nav: "#0a0a0f", line: "#3d4557", tag: "#3d4557", text: "#ffffff", muted: "#a0aec0" };

const ic = (d, w = 20) => <svg width={w} height={w} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">{d}</svg>;
const SearchIcon = () => ic(<><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></>, 16);

export default function AddressInput({value,onChange,style:s}){
  const[sug,setSug]=useState([]);const[show,setShow]=useState(false);const[tok,setTok]=useState(null);const[loaded,setLoaded]=useState(false);const debRef=useRef(null);const wRef=useRef(null);
  useEffect(()=>{if(window.google?.maps?.places){setLoaded(true);return;}const ex=document.querySelector(`script[src*="maps.googleapis.com"]`);if(ex){ex.addEventListener("load",()=>setLoaded(true));return;}const sc=document.createElement("script");sc.src=`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&loading=async`;sc.async=true;sc.defer=true;sc.onload=()=>setLoaded(true);document.head.appendChild(sc);},[]);
  useEffect(()=>{if(loaded&&window.google?.maps?.places)try{setTok(new window.google.maps.places.AutocompleteSessionToken());}catch{}},[loaded]);
  useEffect(()=>{const h=e=>{if(wRef.current&&!wRef.current.contains(e.target))setShow(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const fetch=useCallback(input=>{if(!loaded||!input||input.length<3){setSug([]);return;}try{new window.google.maps.places.AutocompleteService().getPlacePredictions({input,types:["address"],componentRestrictions:{country:"us"},sessionToken:tok},(p,st)=>{if(st===window.google.maps.places.PlacesServiceStatus.OK&&p){setSug(p.map(x=>({description:x.description})));setShow(true);}else setSug([]);});}catch{}},[loaded,tok]);
  const hc=e=>{onChange(e);if(debRef.current)clearTimeout(debRef.current);debRef.current=setTimeout(()=>fetch(e.target.value),300);};
  const hs=d=>{onChange({target:{value:d}});setShow(false);setSug([]);try{setTok(new window.google.maps.places.AutocompleteSessionToken());}catch{}};
  return(<div ref={wRef} style={{position:"relative"}}><input type="text" value={value} onChange={hc} onFocus={()=>{if(sug.length>0)setShow(true);}} placeholder="Start typing an address..." style={s}/>
    {show&&sug.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:t.nav,border:`1.5px solid ${t.line}`,borderRadius:"0 0 10px 10px",boxShadow:"0 4px 16px rgba(0,0,0,.5)",zIndex:100,maxHeight:"200px",overflowY:"auto"}}>
      {sug.map((x,i)=><div key={i} onClick={()=>hs(x.description)} style={{padding:"12px 16px",cursor:"pointer",fontSize:"14px",color:t.text,borderBottom:i<sug.length-1?`1px solid ${t.line}`:"none",display:"flex",alignItems:"center",gap:"8px"}} onMouseEnter={e=>e.currentTarget.style.background=t.tag} onMouseLeave={e=>e.currentTarget.style.background=t.nav}><SearchIcon/>{x.description}</div>)}</div>}</div>);
}
