"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Library, KeyRound, ShieldCheck, LogIn, Menu, X, ChevronDown, LogOut, UserRound, Users, Copy, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import BackgroundMusic from "@/components/BackgroundMusic";

const baseLinks = [
  { href: "/", label: "Marketplace", icon: Home },
  { href: "/library", label: "My Library", icon: Library },
  { href: "/licenses", label: "Licenses", icon: KeyRound },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [fullyVerified, setFullyVerified] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [serverStatusLoading, setServerStatusLoading] = useState(true);
  const [copiedIp, setCopiedIp] = useState(false);

  useEffect(() => {
    let active = true;

    async function refreshRole(userId?: string) {
      if (!active || !supabase || !userId) {
        if (active) {
          setIsAdmin(false);
          setNickname(null);
          setFullyVerified(false);
        }
        return;
      }

      // Keep Admin visibility dependent ONLY on the long-standing `role` column.
      // Newer optional profile fields (nickname / verification_status) must never
      // be able to hide the Admin tab if their migration is missing or delayed.
      const { data: roleData, error: roleError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;
      setIsAdmin(!roleError && roleData?.role === "admin");

      const { data: profileData } = await supabase
        .from("profiles")
        .select("nickname,verification_status")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;
      setNickname(profileData?.nickname ?? null);
      setFullyVerified(profileData?.verification_status === "verified");
    }

    async function applySession(session: Session | null) {
      if (!active) return;
      setUserEmail(session?.user.email ?? null);
      setIsAdmin(false);
      await refreshRole(session?.user.id);
      if (active) setAuthReady(true);
    }

    async function initialize() {
      if (!supabase) {
        setAuthReady(true);
        return;
      }
      const { data } = await supabase.auth.getSession();
      await applySession(data.session);
    }

    void initialize();

    const { data: authListener } = supabase?.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    }) ?? { data: null };

    return () => {
      active = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function closeAccount(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", closeAccount);
    return () => document.removeEventListener("mousedown", closeAccount);
  }, []);

  useEffect(() => {
    let active = true;
    async function refreshServerStatus() {
      try {
        const response = await fetch("/api/community-status", { cache: "no-store" });
        if (!response.ok) throw new Error("status unavailable");
        const data = await response.json();
        if (active) setServerStatus(data?.minecraft ?? null);
      } catch {
        if (active) setServerStatus(null);
      } finally {
        if (active) setServerStatusLoading(false);
      }
    }
    void refreshServerStatus();
    const timer = window.setInterval(refreshServerStatus, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function copyServerIp() {
    try {
      await navigator.clipboard.writeText("aevonsmp.online");
      setCopiedIp(true);
      window.setTimeout(() => setCopiedIp(false), 1600);
    } catch {}
  }

  async function signOut() {
    setAccountOpen(false);
    await supabase?.auth.signOut();
    setUserEmail(null);
    setIsAdmin(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="shell">
      <header className="siteHeader">
        <div className="siteHeaderInner">
          <Link href="/" className="siteBrand" onClick={() => setOpen(false)}>
            <img src="/assets/aevon-bird.png" alt="Aevon bird" className="siteBird" />
            <div className="siteBrandWords">
              <strong><span>AEVON</span>PLUGINS</strong>
              <small>MARKETPLACE</small>
            </div>
          </Link>

          <button className="mobileMenuBtn" onClick={() => setOpen(v => !v)} aria-label="Toggle navigation">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>

          <nav className={open ? "siteNav open" : "siteNav"}>
            {baseLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={pathname === href ? "siteNavItem active" : "siteNavItem"}
              >
                <Icon size={16} />
                <span>{label}</span>
              </Link>
            ))}

            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className={pathname.startsWith("/admin") ? "siteNavItem active" : "siteNavItem"}
              >
                <ShieldCheck size={16} />
                <span>Admin</span>
              </Link>
            )}

            {!authReady ? (
              <span className="siteNavItem accountLoading"><UserRound size={16}/><span>Account</span></span>
            ) : userEmail ? (
              <div className="accountMenu" ref={accountRef}>
                <button className="siteNavItem accountButton" type="button" onClick={() => setAccountOpen(v => !v)} aria-expanded={accountOpen}>
                  <UserRound size={16} />
                  <span className="accountEmail">{nickname || userEmail}</span>{fullyVerified && <ShieldCheck size={13} className="verifiedBadge"/>}
                  <ChevronDown size={14} />
                </button>
                {accountOpen && (
                  <div className="accountDropdown">
                    <div className="accountDropdownIdentity">
                      <small>Signed in as</small>
                      <strong>{nickname || userEmail}</strong>
                      {fullyVerified && <span className="dropdownVerified">✓ Fully Verified</span>}
                    </div>
                    <Link href="/account" onClick={() => {setOpen(false);setAccountOpen(false)}}><UserRound size={15}/> Profile / My Account</Link>
                    <Link href="/account#purchased" onClick={() => {setOpen(false);setAccountOpen(false)}}><Library size={15}/> Purchased Plugins</Link>
                    <Link href="/account#verification" onClick={() => {setOpen(false);setAccountOpen(false)}}><ShieldCheck size={15}/> Verify Account</Link>
                    <button type="button" onClick={signOut}><LogOut size={15}/> Sign out</button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" onClick={() => setOpen(false)} className={pathname === "/login" ? "siteNavItem active" : "siteNavItem"}>
                <LogIn size={16} />
                <span>Login</span>
              </Link>
            )}
          </nav>
          <div className="headerMinecraftStatus" aria-label="AevonSMP live server status">
            <span className={`headerMinecraftDot ${serverStatusLoading ? "checking" : serverStatus?.available === false || !serverStatus ? "unavailable" : serverStatus?.online ? "online" : "offline"}`} />
            <strong>{serverStatusLoading ? "CHECKING…" : serverStatus?.available === false || !serverStatus ? "STATUS UNAVAILABLE" : serverStatus?.online ? "ONLINE" : "OFFLINE"}</strong>
            <button type="button" onClick={copyServerIp} title="Copy server IP">
              <span>aevonsmp.online</span>{copiedIp ? <Check size={11}/> : <Copy size={11}/>}
            </button>
            <span className="headerMinecraftPlayers"><Users size={12}/><b>{serverStatusLoading || !serverStatus?.available ? "—" : serverStatus?.playersOnline ?? 0}</b>{serverStatus?.available && serverStatus?.playersMax ? ` / ${serverStatus.playersMax}` : ""} Players</span>
          </div>
        </div>
      </header>

      <main className="main">{children}</main>

      <BackgroundMusic />

      <footer className="siteFooter">
        <div className="siteFooterInner">
          <div className="footerBrand">
            <img src="/assets/aevon-bird.png" alt="" />
            <div><strong>Aevon Plugins Marketplace</strong><span>Premium tools for your Minecraft community.</span></div>
          </div>
          <span>© 2026 Aevon Projects</span>
        </div>
      </footer>
    </div>
  );
}
