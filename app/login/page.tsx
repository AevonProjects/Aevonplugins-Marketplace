"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, LogIn, LogOut, MailCheck, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "register" | "forgot" | "reset";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data } = supabase?.auth.onAuthStateChange((event, session) => {
      setUserEmail(session?.user.email ?? null);
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        setMessage("Recovery link verified. Choose a new password.");
      }
    }) ?? { data: null };
    return () => data?.subscription.unsubscribe();
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  async function login(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return setMessage("Supabase environment variables are missing.");
    setBusy(true);
    setMessage("Signing in…");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    setMessage(error ? error.message : "Signed in successfully.");
  }

  async function register(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setMessage("Use a password with at least 8 characters.");
    if (password !== confirmPassword) return setMessage("Passwords do not match.");

    setBusy(true);
    setMessage("Checking registration security…");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, displayName: displayName.trim() })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Registration failed.");
      setMessage(body.message || "Registration submitted. Check your email to verify your account before signing in.");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  async function forgot(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return setMessage("Supabase environment variables are missing.");
    setBusy(true);
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setBusy(false);
    setMessage(error ? error.message : "If an account exists for that email, a password reset link has been sent.");
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return setMessage("Supabase environment variables are missing.");
    if (password.length < 8) return setMessage("Use a password with at least 8 characters.");
    if (password !== confirmPassword) return setMessage("Passwords do not match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMessage(error.message);
    setMessage("Password updated successfully. You can continue using your account.");
    setPassword("");
    setConfirmPassword("");
  }

  async function logout() {
    await supabase?.auth.signOut();
    setMessage("Signed out.");
    setUserEmail(null);
    setMode("login");
  }

  return <div className="pageWrap narrow accountPage">
    <p className="eyebrow">AEVON ACCOUNT</p>
    <h1>{mode === "register" ? "Create your account" : mode === "forgot" ? "Forgot password" : mode === "reset" ? "Choose a new password" : "Marketplace Login"}</h1>
    <p className="muted">Verified accounts protect plugin purchases, licenses, and downloads.</p>

    <div className="formCard accountCard">
      {userEmail && mode !== "reset" ? <>
        <div className="signedInMark"><MailCheck size={28}/></div>
        <h3>Signed in</h3>
        <p className="muted">{userEmail}</p>
        <button className="primaryBtn" onClick={logout}><LogOut size={16}/> Sign out</button>
      </> : <>
        {mode !== "reset" && <div className="authTabs">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => switchMode("login")}>Login</button>
          <button className={mode === "register" ? "active" : ""} type="button" onClick={() => switchMode("register")}>Register</button>
        </div>}

        {mode === "login" && <form onSubmit={login}>
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
          <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
          <button className="primaryBtn" disabled={busy} type="submit"><LogIn size={16}/> {busy ? "Signing in…" : "Sign in"}</button>
          <button className="authTextButton" type="button" onClick={() => switchMode("forgot")}>Forgot your password?</button>
        </form>}

        {mode === "register" && <form onSubmit={register}>
          <label>Display name <span className="optional">Optional</span><input type="text" maxLength={40} autoComplete="name" value={displayName} onChange={e=>setDisplayName(e.target.value)} /></label>
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
          <label>Password<input type="password" minLength={8} autoComplete="new-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
          <label>Confirm password<input type="password" minLength={8} autoComplete="new-password" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} /></label>
          <div className="securityNote">Registration checks the connection IP and blocks repeat registrations from the same IP. VPN/proxy registrations are rejected when reputation protection is configured.</div>
          <button className="primaryBtn" disabled={busy} type="submit"><UserPlus size={16}/> {busy ? "Creating account…" : "Create account"}</button>
        </form>}

        {mode === "forgot" && <form onSubmit={forgot}>
          <div className="authIcon"><KeyRound size={25}/></div>
          <p className="muted authHelp">Enter your account email and we’ll send a secure password-reset link.</p>
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
          <button className="primaryBtn" disabled={busy} type="submit"><KeyRound size={16}/> {busy ? "Sending…" : "Send reset link"}</button>
          <button className="authTextButton" type="button" onClick={() => switchMode("login")}>Back to login</button>
        </form>}

        {mode === "reset" && <form onSubmit={resetPassword}>
          <label>New password<input type="password" minLength={8} autoComplete="new-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
          <label>Confirm new password<input type="password" minLength={8} autoComplete="new-password" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} /></label>
          <button className="primaryBtn" disabled={busy} type="submit"><KeyRound size={16}/> {busy ? "Updating…" : "Update password"}</button>
        </form>}
      </>}
      {message && <p className="formMessage" aria-live="polite">{message}</p>}
    </div>
  </div>;
}
