"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, ImagePlus, MessageSquareText, Send, Trash2, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { paymentConfig } from "@/lib/paymentConfig";

type Ticket={
  id:string;order_kind:"marketplace"|"aevonsmp";order_id:string;order_code:string;user_id:string;
  customer_email:string;product_name:string;amount:number;subject:string;status:string;created_at:string;updated_at:string
};
type Msg={
  id:string;user_id:string;sender_role:"buyer"|"admin";message:string|null;image_path?:string|null;image_url?:string|null;created_at:string
};

export default function GcashTicketPage({params}:{params:Promise<{id:string}>}){
  const [id,setId]=useState("");
  const [ticket,setTicket]=useState<Ticket|null>(null);
  const [messages,setMessages]=useState<Msg[]>([]);
  const [viewer,setViewer]=useState<{id:string;role:"buyer"|"admin"}|null>(null);
  const [text,setText]=useState("");
  const [image,setImage]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");

  useEffect(()=>{void params.then(p=>setId(p.id))},[params]);

  const token=async()=> (await supabase?.auth.getSession())?.data.session?.access_token||"";

  const load=useCallback(async()=>{
    if(!id)return;
    const t=await token();
    if(!t){setNotice("Please sign in to open this ticket.");return}
    const r=await fetch(`/api/gcash/tickets/${id}`,{headers:{Authorization:`Bearer ${t}`},cache:"no-store"});
    const b=await r.json().catch(()=>({}));
    if(!r.ok){setNotice(b.error||"Could not load ticket.");return}
    setTicket(b.ticket);setMessages(b.messages||[]);setViewer(b.viewer||null);
  },[id]);

  useEffect(()=>{
    void load();
    if(!id)return;
    const timer=setInterval(()=>void load(),5000);
    return()=>clearInterval(timer)
  },[id,load]);

  async function uploadPicture(file:File){
    if(!id||!supabase)throw new Error("Ticket is not ready.");
    if(!file.type.startsWith("image/"))throw new Error("Only picture files are allowed.");
    if(file.size>5*1024*1024)throw new Error("Picture must be 5 MB or smaller.");

    const r=await fetch(`/api/gcash/tickets/${id}/image-upload`,{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${await token()}`},
      body:JSON.stringify({fileName:file.name,contentType:file.type,size:file.size})
    });
    const b=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(b.error||"Could not prepare picture upload.");

    const {error}=await supabase.storage.from("gcash-ticket-images").uploadToSignedUrl(b.path,b.token,file,{contentType:file.type});
    if(error)throw error;
    return String(b.path);
  }

  async function send(){
    const msg=text.trim();
    if((!msg&&!image)||!id)return;
    setBusy(true);setNotice("");
    try{
      const imagePath=image?await uploadPicture(image):null;
      const r=await fetch(`/api/gcash/tickets/${id}/messages`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${await token()}`},
        body:JSON.stringify({message:msg,imagePath})
      });
      const b=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(b.error||"Could not send message.");
      setText("");setImage(null);await load();
    }catch(e:any){
      setNotice(e?.message||"Could not send message.");
    }finally{
      setBusy(false);
    }
  }

  async function review(action:"approve"|"reject"){
    if(viewer?.role!=="admin"||!ticket)return;
    if(!confirm(`${action==="approve"?"Approve":"Reject"} ${ticket.order_code}?`))return;
    setBusy(true);
    const url=ticket.order_kind==="marketplace"
      ?`/api/admin/orders/${ticket.order_id}/${action}`
      :`/api/admin/aevonsmp/orders/${ticket.order_id}/${action}`;
    const r=await fetch(url,{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${await token()}`},
      body:JSON.stringify({note:"Reviewed through website GCash ticket."})
    });
    const b=await r.json().catch(()=>({}));setBusy(false);
    setNotice(r.ok?(action==="approve"?"Payment approved successfully.":"Payment rejected."):(b.error||"Could not update payment."));
    await load();
  }

  async function cancelPurchase(){
    if(viewer?.role!=="buyer"||!ticket||ticket.status!=="open")return;
    if(!confirm(`Cancel purchase ${ticket.order_code}?\\n\\nThe order will be cancelled and will not be delivered.`))return;
    setBusy(true);setNotice("");
    const r=await fetch(`/api/gcash/tickets/${ticket.id}/cancel`,{method:"POST",headers:{Authorization:`Bearer ${await token()}`}});
    const b=await r.json().catch(()=>({}));setBusy(false);
    setNotice(r.ok?"Purchase cancelled successfully.":(b.error||"Could not cancel purchase."));
    await load();
  }

  async function deleteTicket(){
    if(viewer?.role!=="admin"||!ticket||ticket.status==="open")return;
    if(!confirm(`Permanently delete ${ticket.order_code}?\\n\\nThe ticket, messages, and uploaded pictures will be deleted forever.`))return;
    setBusy(true);
    const r=await fetch(`/api/admin/gcash/tickets/${ticket.id}`,{method:"DELETE",headers:{Authorization:`Bearer ${await token()}`}});
    const b=await r.json().catch(()=>({}));setBusy(false);
    if(!r.ok){setNotice(b.error||"Could not delete ticket.");return}
    window.location.href="/admin";
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
        <p>Scan the QR and pay exactly <b>₱{Number(ticket.amount).toFixed(2)}</b>. Send your GCash payment reference or a screenshot in the private conversation so the admin can verify it.</p>
        <div className="verificationNotice"><Clock3 size={18}/><div><strong>Manual verification</strong><p>Your product is not delivered until an administrator confirms the GCash payment.</p></div></div>

        {viewer?.role==="buyer"&&ticket.status==="open"&&
          <button className="dangerBtn ticketCancelPurchase" disabled={busy} onClick={cancelPurchase}><XCircle size={14}/> Cancel My Purchase</button>}

        {viewer?.role==="admin"&&ticket.status==="open"&&<div className="ticketAdminReview">
          <button className="secondaryBtn" disabled={busy} onClick={()=>review("reject")}><XCircle size={14}/> Reject</button>
          <button className="primaryBtn" disabled={busy} onClick={()=>review("approve")}><CheckCircle2 size={14}/> Approve Payment</button>
        </div>}

        {viewer?.role==="admin"&&ticket.status!=="open"&&
          <button className="dangerBtn ticketPermanentDelete" disabled={busy} onClick={deleteTicket}><Trash2 size={14}/> Permanently Delete Ticket</button>}
      </section>

      <section className="accountPanel gcashConversation">
        <div className="sectionHeading"><div><h2><MessageSquareText size={20}/> Payment Conversation</h2><p className="muted smallMuted">{viewer?.role==="admin"?"Admin ↔ Buyer":"You ↔ Aevon Admin"}</p></div></div>
        <div className="ticketMessages">{messages.length===0?<div className="ticketNoMessages">No messages yet. Send your GCash reference, screenshot, or a message here after paying.</div>:messages.map(m=><div key={m.id} className={`ticketMessage ${m.sender_role} ${m.user_id===viewer?.id?"mine":""}`}>
          <div className="ticketMessageMeta"><b>{m.sender_role==="admin"?"Aevon Admin":"Buyer"}</b><span>{new Date(m.created_at).toLocaleString()}</span></div>
          {m.message&&<p>{m.message}</p>}
          {m.image_url&&<a href={m.image_url} target="_blank" rel="noreferrer"><img className="ticketChatImage" src={m.image_url} alt="Ticket attachment"/></a>}
        </div>)}</div>

        <div className="ticketComposer">
          <textarea value={text} onChange={e=>setText(e.target.value)} maxLength={4000} placeholder={viewer?.role==="admin"?"Reply to the buyer…":"Send your GCash reference or a message to the admin…"}/>
          <div className="ticketComposerActions">
            <label className="secondaryBtn ticketImagePicker"><ImagePlus size={14}/>{image?image.name:"Add Picture"}<input hidden type="file" accept="image/*" onChange={e=>setImage(e.target.files?.[0]||null)}/></label>
            <button className="primaryBtn" disabled={busy||(!text.trim()&&!image)} onClick={send}><Send size={14}/> {busy?"Sending…":"Send"}</button>
          </div>
        </div>
        {image&&<div className="ticketAttachmentPreview"><span>Picture ready: <b>{image.name}</b></span><button className="secondaryBtn" onClick={()=>setImage(null)}>Remove</button></div>}
      </section>
    </div>
    {notice&&<div className="notice info">{notice}</div>}
  </div>
}
