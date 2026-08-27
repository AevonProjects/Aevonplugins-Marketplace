"use client";

import { FormEvent, useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data } = supabase?.auth.onAuthStateChange((_event, session) => setUserEmail(session?.user.email ?? null)) ?? { data: null };
    return () => data?.subscription.unsubscribe();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return setMessage("Supabase environment variables are missing.");
    setMessage("Signing in…");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "Signed in successfully.");
  }

  async function logout() {
    await supabase?.auth.signOut();
    setMessage("Signed out.");
  }

  return <div className="pageWrap narrow">
    <p className="eyebrow">ACCOUNT</p><h1>Marketplace Login</h1>
    <p className="muted">Use the Supabase account you created for Aevon Marketplace.</p>
    <div className="formCard">
      {userEmail ? <>
        <h3>Signed in</h3><p className="muted">{userEmail}</p>
        <button className="primaryBtn" onClick={logout}><LogOut size={16}/> Sign out</button>
      </> : <form onSubmit={submit}>
        <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
        <button className="primaryBtn" type="submit"><LogIn size={16}/> Sign in</button>
      </form>}
      {message && <p className="formMessage">{message}</p>}
    </div>
  </div>;
}
