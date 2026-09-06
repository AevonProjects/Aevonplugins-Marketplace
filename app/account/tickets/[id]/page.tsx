"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, MessageSquareText, Send, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { paymentConfig } from "@/lib/paymentConfig";

type Ticket={id:string;order_kind:"marketplace"|"aevonsmp";order_id:string;order_code:string;user_id:string;customer_email:string;product_name:string;amount:number;subject:string;status:string;created_at:string;updated_at:string};
type Msg={id:string;user_id:string;sender_role:"buyer"|"admin";message:string;created_at:string};

export default function GcashTicketPage({params}:{params:Promise<{id:string}>}){
  const [id,setId]=useState("");
  const [ticket,setTicket]=useState<Ticket|null>(null);
  const [messages,setMessages]=useState<Msg[]>([]);
  const [viewer,setViewer]=useState<{id:string;role:"buyer"|"admin"}|null>(null);
  const [text,setText]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");

  useEffect(()=>{void params.then(p=>setId(p.id))},[params]);

  const token=async()=> (await supabase?.auth.getSession())?.data.session?.access_token||"";
  const load=useCallback(async()=>{
    if(!id)return;
    const t=await token(); if(!t){setNotice("Please sign in to open this ticket.");return}
    const r=await fetch(`/api/gcash/tickets/${id}`,{headers:{Authorization:`Bearer ${t}`},cache:"no-store"});
    const b=await r.json().catch(()=>({}));
    if(!r.ok){setNotice(b.error||"Could not load ticket.");return}
    setTicket(b.ticket);setMessages(b.messages||[]);setViewer(b.viewer||null);
  },[id]);

  useEffect(()=>{void load(); if(!id)return; const timer=setInterval(()=>void load(),5000); return()=>clearInterval(timer)},[id,load]);

  async function send(){
    const msg=text.trim();if(!msg||!id)return;setBusy(true);
    const r=await fetch(`/api/gcash/tickets/${id}/messages`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${await token()}`},body:JSON.stringify({message:msg})});
    const b=await r.json().catch(()=>({}));setBusy(false);
    if(!r.ok){setNotice(b.error||"Could not send message.");return}
    setText("");await load();
  }

  async function review(action:"approve"|"reject"){
    if(viewer?.role!=="admin"||!ticket)return;
    if(!confirm(`${action==="approve"?"Approve":"Reject"} ${ticket.order_code}?`))return;
    setBusy(true);
    const url=ticket.order_kind==="marketplace"?`/api/admin/orders/${ticket.order_id}/${action}`:`/api/admin/aevonsmp/orders/${ticket.order_id}/${action}`;
    const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${await token()}`},body:JSON.stringify({note:"Reviewed through website GCash ticket."})});
    const b=await r.json().catch(()=>({}));setBusy(false);
    setNotice(r.ok?(action==="approve"?"Payment approved successfully.":"Payment rejected."):(b.error||"Could not update payment."));
    await load();
  }

  if(!ticket)return <div className="pageWrap"><Link className="backLink" href="/account/tickets"><ArrowLeft size={15}/> My Tickets</Link><div className="emptyCard">{notice||"Loading ticket…"}</div></div>;

  return <div className="pageWrap gcashTicketDetail">
    <Link className="backLink" href={viewer?.role==="admin"?"/admin":"/account/tickets"}><ArrowLeft size={15}/> {viewer?.role==="admin"?"Admin Dashboard":"My Tickets"}</Link>

    <section className="gcashTicketHeader">
      <div><p className="eyebrow">{ticket.order_kind==="marketplace"?"AEVONPLUGINS":"AEVONSMP"} · GCASH</p><h1>{ticket.product_name}</h1><code>{ticket.order_code}</code><p>{ticket.customer_email}</p></div>
      <div className="ticketAmount"><span>Amount to Pay</span><strong>₱{Number(ticket.amount).toFixed(2)}</strong><span className={`ticketStatus ${ticket.status}`}>{ticket.status}</span></div>
    </section>

    <div className="gcashTicketColumns">
      <section className="accountPanel gcashPaymentPanel">
        <h2>GCash Payment</h2>
        {paymentConfig.gcashQrUrl&&<img className="ticketQr" src={paymentConfig.gcashQrUrl} alt="GCash QR Code"/>}
        {paymentConfig.gcashAccountName&&<strong>{paymentConfig.gcashAccountName}</strong>}
        {paymentConfig.gcashNumber&&<p>GCash Mobile: <b>{paymentConfig.gcashNumber}</b></p>}
        <p>Scan the QR and pay exactly <b>₱{Number(ticket.amount).toFixed(2)}</b>. Keep your GCash receipt/reference and send it in the conversation so the admin can verify your payment.</p>
        <div className="verificationNotice"><Clock3 size={18}/><div><strong>Manual verification</strong><p>Your product is not delivered until an administrator confirms the GCash payment.</p></div></div>
        {viewer?.role==="admin"&&ticket.status==="open"&&<div className="ticketAdminReview">
          <button className="secondaryBtn" disabled={busy} onClick={()=>review("reject")}><XCircle size={14}/> Reject</button>
          <button className="primaryBtn" disabled={busy} onClick={()=>review("approve")}><CheckCircle2 size={14}/> Approve Payment</button>
        </div>}
      </section>

      <section className="accountPanel gcashConversation">
        <div className="sectionHeading"><div><h2><MessageSquareText size={20}/> Payment Conversation</h2><p className="muted smallMuted">{viewer?.role==="admin"?"Admin ↔ Buyer":"You ↔ Aevon Admin"}</p></div></div>
        <div className="ticketMessages">{messages.length===0?<div className="ticketNoMessages">No messages yet. Send your GCash reference or payment details here after paying.</div>:messages.map(m=><div key={m.id} className={`ticketMessage ${m.sender_role} ${m.user_id===viewer?.id?"mine":""}`}>
          <div className="ticketMessageMeta"><b>{m.sender_role==="admin"?"Aevon Admin":"Buyer"}</b><span>{new Date(m.created_at).toLocaleString()}</span></div>
          <p>{m.message}</p>
        </div>)}</div>
        <div className="ticketComposer"><textarea value={text} onChange={e=>setText(e.target.value)} maxLength={4000} placeholder={viewer?.role==="admin"?"Reply to the buyer…":"Send your GCash reference, payment details, or a message to the admin…"}/><button className="primaryBtn" disabled={busy||!text.trim()} onClick={send}><Send size={14}/> Send</button></div>
      </section>
    </div>
    {notice&&<div className="notice info">{notice}</div>}
  </div>
}
