"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function PayPalReturnPage() {
  const params = useSearchParams();
  const paypalOrderId = params.get("token") || "";
  const pluginSlug = params.get("plugin") || "";
  const [state, setState] = useState<"loading"|"success"|"error">("loading");
  const [message, setMessage] = useState("Confirming your PayPal payment…");

  useEffect(() => {
    (async () => {
      if (!paypalOrderId || !supabase) { setState("error"); setMessage("PayPal did not return a valid order."); return; }
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setState("error"); setMessage("Your sign-in session expired. Sign in again and contact support with your PayPal receipt if payment was completed."); return; }
      const response = await fetch("/api/orders/paypal/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paypalOrderId })
      });
      const body = await response.json();
      if (!response.ok) { setState("error"); setMessage(body.error || "We could not confirm your PayPal payment."); return; }
      setState("success"); setMessage("Payment confirmed! Your plugin ownership and license are now active.");
    })();
  }, [paypalOrderId]);

  return <div className="pageWrap paypalReturnWrap">
    <div className={`paypalReturnCard ${state}`}>
      {state === "loading" ? <LoaderCircle className="spin" size={38}/> : state === "success" ? <CheckCircle2 size={38}/> : <TriangleAlert size={38}/>} 
      <h1>{state === "loading" ? "Confirming Payment" : state === "success" ? "Payment Successful" : "Payment Needs Attention"}</h1>
      <p>{message}</p>
      {state !== "loading" && <div className="paymentActionRow">
        {state === "success" && <Link className="primaryBtn" href="/library">Open My Library</Link>}
        <Link className="secondaryBtn" href={pluginSlug ? `/plugins/${encodeURIComponent(pluginSlug)}` : "/"}>Back to Plugin</Link>
      </div>}
    </div>
  </div>;
}
