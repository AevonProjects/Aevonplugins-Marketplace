"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { Download,Library,Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LibraryPage(){
  const[items,setItems]=useState<any[]>([]);
  const[msg,setMsg]=useState("Loading…");
  const[busy,setBusy]=useState<string|null>(null);

  useEffect(()=>{(async()=>{
    if(!supabase)return setMsg("Authentication is not configured.");
    const{data:s}=await supabase.auth.getSession();
    const token=s.session?.access_token;
    if(!token)return setMsg("Sign in to view your plugin library.");
    const r=await fetch("/api/account/library",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
    const b=await r.json().catch(()=>({}));
    if(!r.ok)return setMsg(b.error||"Could not load your plugin library.");
    setItems(b.items||[]);
    setMsg((b.items||[]).length?"":"You don't have any plugins yet.");
  })()},[]);

  async function download(item:any){
    if(!supabase)return;
    setBusy(item.id);
    const{data:s}=await supabase.auth.getSession();
    const token=s.session?.access_token;
    const r=await fetch(`/api/plugins/${item.plugins.id}/download`,{method:"POST",headers:{Authorization:`Bearer ${token}`}});
    const j=await r.json().catch(()=>({}));
    setBusy(null);
    if(!r.ok)return alert(j.error||"Download failed.");
    window.location.href=j.url;
  }

  return <div className="pageWrap"><p className="eyebrow">ACCOUNT</p><h1>My Library</h1><p className="muted">Plugins attached to your marketplace account.</p>{msg&&<div className="emptyCard"><Library size={24}/><span>{msg}</span></div>}<div className="grid">{items.map((item:any)=><article className="pluginCard" key={item.id}><div className="pluginIcon"><Library size={26}/></div><div className="pluginBody"><h3>{item.plugins?.name??"Plugin"}</h3><p>{item.plugins?.description??""}</p><span className="version">{item.access_type}</span><div className="libraryActions"><Link className="secondaryBtn" href={`/plugins/${item.plugins.slug}`}>View</Link><button className="primaryBtn" onClick={()=>download(item)} disabled={busy===item.id}>{busy===item.id?<Loader2 className="spin" size={15}/>:<Download size={15}/>} Download</button></div></div></article>)}</div></div>
}
