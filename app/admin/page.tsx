"use client";

import { FormEvent, useEffect, useState } from "react";
import { ShieldCheck, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AdminPage(){
  const [allowed,setAllowed]=useState(false); const [message,setMessage]=useState("Checking admin access…");
  const [name,setName]=useState(""); const [slug,setSlug]=useState(""); const [description,setDescription]=useState(""); const [version,setVersion]=useState("1.0.0"); const [price,setPrice]=useState("0");
  useEffect(()=>{(async()=>{if(!supabase)return setMessage("Supabase is not configured."); const {data:auth}=await supabase.auth.getUser(); if(!auth.user)return setMessage("Sign in with your admin account first."); const {data,error}=await supabase.from("profiles").select("role").eq("id",auth.user.id).single(); if(error||data?.role!=="admin")return setMessage("This account does not have admin access."); setAllowed(true); setMessage("");})()},[]);
  async function createPlugin(e:FormEvent){e.preventDefault(); if(!supabase)return; setMessage("Creating plugin…"); const {error}=await supabase.from("plugins").insert({name,slug:slug||name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),description,version,price:Number(price)||0,status:"published"}); setMessage(error?error.message:"Plugin created successfully."); if(!error){setName("");setSlug("");setDescription("");}}
  return <div className="pageWrap narrow"><p className="eyebrow">ADMINISTRATION</p><h1>Admin Dashboard</h1><p className="muted">Create marketplace listings using your secured admin role.</p>{!allowed?<div className="emptyCard"><ShieldCheck size={24}/><span>{message}</span></div>:<div className="formCard"><h3>Add Plugin</h3><form onSubmit={createPlugin}><label>Name<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Slug<input value={slug} onChange={e=>setSlug(e.target.value)} placeholder="alicense"/></label><label>Description<textarea required value={description} onChange={e=>setDescription(e.target.value)}/></label><div className="twoCol"><label>Version<input required value={version} onChange={e=>setVersion(e.target.value)}/></label><label>Price<input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label></div><button className="primaryBtn" type="submit"><Plus size={16}/> Publish plugin</button></form>{message&&<p className="formMessage">{message}</p>}</div>}</div>
}
