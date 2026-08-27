"use client";

import { useEffect, useState } from "react";
import { Library } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LibraryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState("Loading…");
  useEffect(()=>{(async()=>{
    if(!supabase) return setMessage("Supabase is not configured.");
    const { data: auth } = await supabase.auth.getUser();
    if(!auth.user) return setMessage("Sign in to view your plugin library.");
    const { data, error } = await supabase.from("user_plugins").select("id,access_type,created_at,plugins(name,version,description)").order("created_at",{ascending:false});
    if(error) return setMessage(error.message);
    setItems(data ?? []); setMessage(data?.length ? "" : "You don't have any plugins yet.");
  })()},[]);
  return <div className="pageWrap"><p className="eyebrow">ACCOUNT</p><h1>My Library</h1><p className="muted">Plugins attached to your marketplace account.</p>
    {message && <div className="emptyCard"><Library size={24}/><span>{message}</span></div>}
    <div className="grid">{items.map((item:any)=><article className="pluginCard" key={item.id}><div className="pluginIcon"><Library size={26}/></div><div className="pluginBody"><h3>{item.plugins?.name ?? "Plugin"}</h3><p>{item.plugins?.description ?? ""}</p><span className="version">{item.access_type}</span></div></article>)}</div>
  </div>
}
