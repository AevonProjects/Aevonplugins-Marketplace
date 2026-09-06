"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageSquareText, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";

type T={id:string;order_kind:string;order_id:string;order_code:string;customer_email:string;product_name:string;amount:number;subject:string;status:string;created_at:string;updated_at:string};

export default function AdminGcashTickets(){
  const [tickets,setTickets]=useState<T[]>([]);
  const [loading,setLoading]=useState(false);
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);
    const token=(await supabase?.auth.getSession())?.data.session?.access_token||"";
    if(!token){setLoading(false);return}
    const r=await fetch("/api/admin/gcash/tickets",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
    const b=await r.json().catch(()=>({}));
    setLoading(false);
    if(!r.ok){setNotice(b.error||"Could not load GCash tickets.");return}
    setTickets(b.tickets||[]);
  },[]);

  useEffect(()=>{void load()},[load]);

  return <section className="adminListSection">
    <div className="sectionHeading">
      <div><p className="eyebrow">GCASH SUPPORT</p><h2>Payment Tickets</h2><p className="muted smallMuted">Private buyer/admin conversations for GCash purchases from both AevonPlugins and AevonSMP.</p></div>
      <button className="secondaryBtn" onClick={load} disabled={loading}><RefreshCw size={14} className={loading?"spin":""}/> Refresh Tickets</button>
    </div>
    {notice&&<div className="notice info">{notice}</div>}
    <div className="paymentOrderList">{tickets.length===0?<div className="emptyCard">No GCash payment tickets yet.</div>:tickets.map(t=><div className={`paymentOrderRow ${t.status}`} key={t.id}>
      <div className="paymentOrderMain">
        <div className="adminPluginTitleRow"><h3>{t.product_name}</h3><span className={`ticketStatus ${t.status}`}>{t.status}</span></div>
        <code>{t.order_code}</code>
        <p>{t.customer_email}</p>
        <div className="pluginMeta"><span>{t.order_kind==="marketplace"?"AevonPlugins":"AevonSMP"}</span><span>₱{Number(t.amount).toFixed(2)}</span><span>Updated {new Date(t.updated_at).toLocaleString()}</span></div>
      </div>
      <div className="adminPluginActions"><Link className="primaryBtn" href={`/account/tickets/${t.id}`}><MessageSquareText size={14}/> Open Ticket</Link></div>
    </div>)}</div>
  </section>
}
