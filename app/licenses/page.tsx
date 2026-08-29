"use client";

import { useEffect, useState } from "react";
import { KeyRound, Server, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LicensesPage(){
  const [rows,setRows]=useState<any[]>([]); const [message,setMessage]=useState("Loading…");
  useEffect(()=>{(async()=>{if(!supabase)return setMessage("Supabase is not configured."); const {data:auth}=await supabase.auth.getUser(); if(!auth.user)return setMessage("Sign in to view your licenses."); const {data,error}=await supabase.from("licenses").select("id,license_key,status,download_count,last_download_at,server_id,activated_at,last_validated_at,plugins(name,version)").order("created_at",{ascending:false}); if(error)return setMessage(error.message); setRows(data??[]); setMessage(data?.length?"":"No licenses have been assigned to this account yet.");})()},[]);
  return <div className="pageWrap"><p className="eyebrow">ACCOUNT</p><h1>Licenses</h1><p className="muted">Manage your Aevon plugin licenses and server activations.</p>{message&&<div className="emptyCard"><KeyRound size={24}/><span>{message}</span></div>}<div className="licenseList">{rows.map((r:any)=><div className="licenseRow" key={r.id}><div><strong>{r.plugins?.name??"Plugin"}</strong><span>{r.license_key}</span><small style={{display:"flex",gap:6,alignItems:"center",marginTop:6}}>{r.server_id?<><Server size={14}/> Activated on a server</>:<><ShieldCheck size={14}/> Ready for first activation</>}</small></div><div><span className="version">{r.status}</span><small>{r.download_count} downloads</small>{r.last_validated_at&&<small>Validated {new Date(r.last_validated_at).toLocaleString()}</small>}</div></div>)}</div></div>
}
