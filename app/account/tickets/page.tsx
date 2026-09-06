"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageSquareText, RefreshCw, ReceiptText } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Ticket = {
  id:string; order_kind:string; order_code:string; product_name:string; amount:number;
  subject:string; status:string; created_at:string; updated_at:string;
};

export default function MyGcashTicketsPage(){
  const [tickets,setTickets]=useState<Ticket[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    setLoading(true); setError("");
    const token=(await supabase?.auth.getSession())?.data.session?.access_token||"";
    if(!token){setLoading(false);setError("Please sign in to view your GCash tickets.");return}
    const r=await fetch("/api/gcash/tickets",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
    const b=await r.json().catch(()=>({}));
    setLoading(false);
    if(!r.ok){setError(b.error||"Could not load tickets.");return}
    setTickets(b.tickets||[]);
  },[]);

  useEffect(()=>{void load()},[load]);

  return <div className="pageWrap gcashTicketsPage">
    <div className="sectionHeading">
      <div><p className="eyebrow">MY ACCOUNT</p><h1>GCash Payment Tickets</h1><p className="muted">Only you and Aevon administrators can see these conversations.</p></div>
      <button className="secondaryBtn" onClick={load}><RefreshCw size={14}/> Refresh</button>
    </div>
    {error&&<div className="notice error">{error}</div>}
    {loading?<div className="emptyCard">Loading tickets…</div>:tickets.length===0?<div className="emptyCard"><ReceiptText size={22}/> No GCash tickets yet.</div>:
      <div className="gcashTicketList">{tickets.map(t=><Link className="gcashTicketCard" href={`/account/tickets/${t.id}`} key={t.id}>
        <div><span className={`ticketStatus ${t.status}`}>{t.status}</span><h3>{t.product_name}</h3><code>{t.order_code}</code><p>{t.order_kind==="marketplace"?"AevonPlugins":"AevonSMP"} · ₱{Number(t.amount).toFixed(2)}</p></div>
        <div className="ticketOpen"><MessageSquareText size={18}/><span>Open Ticket</span><small>{new Date(t.updated_at).toLocaleString()}</small></div>
      </Link>)}</div>}
  </div>
}
