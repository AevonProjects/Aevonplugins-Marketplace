"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search, Package, ArrowRight, Sparkles, AlertTriangle, ChevronLeft, ChevronRight,
  ShieldCheck, Zap, Headphones, BadgeCheck, Server, Users, Copy, Check
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type PluginRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  version: string | null;
  price: number;
  status: string;
};

export default function MarketplacePage() {
  const [plugins, setPlugins] = useState<PluginRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const [communityStatus, setCommunityStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [copiedIp, setCopiedIp] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      if (!supabase) {
        setPlugins([]);
        setLoadError("Marketplace database is not configured.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("plugins")
        .select("id,name,slug,description,version,price,status")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load marketplace plugins:", error);
        setPlugins([]);
        setLoadError("We couldn't load the marketplace right now. Please try again shortly.");
      } else {
        setPlugins((data ?? []) as PluginRow[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plugins;
    return plugins.filter(p => `${p.name} ${p.description ?? ""}`.toLowerCase().includes(q));
  }, [plugins, query]);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    let active = true;
    async function loadCommunityStatus() {
      try {
        const response = await fetch("/api/community-status", { cache: "no-store" });
        if (!response.ok) throw new Error("status unavailable");
        const data = await response.json();
        if (active) setCommunityStatus(data);
      } catch {
        if (active) setCommunityStatus(null);
      } finally {
        if (active) setStatusLoading(false);
      }
    }
    void loadCommunityStatus();
    const timer = window.setInterval(loadCommunityStatus, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function copyServerIp() {
    try {
      await navigator.clipboard.writeText("aevonsmp.online");
      setCopiedIp(true);
      window.setTimeout(() => setCopiedIp(false), 1800);
    } catch {}
  }

  function move(direction: number) {
    const rail = railRef.current;
    if (!rail || filtered.length === 0) return;
    const next = Math.max(0, Math.min(filtered.length - 1, activeIndex + direction));
    setActiveIndex(next);
    const card = rail.children[next] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  function goTo(index: number) {
    setActiveIndex(index);
    const card = railRef.current?.children[index] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  return (
    <div className="marketHome">
      <section className="marketHero">
        <div className="heroShade" />
        <div className="marketHeroInner">
          <div className="marketHeroCopy">
            <span className="premiumBadge"><Sparkles size={15} /> PREMIUM PLUGINS <em>FOR YOUR SERVER</em></span>
            <h1>POWER YOUR SERVER<br />WITH <span>PREMIUM</span><br />PLUGINS</h1>
            <p>High quality, optimized and secure Minecraft plugins built for the Aevon community.</p>
            <div className="heroActions">
              <a className="marketPrimaryBtn" href="#plugins"><Package size={18}/> Browse All Plugins</a>
              <Link className="marketGhostBtn" href="/library">My Library <ArrowRight size={17}/></Link>
            </div>
          </div>

          <div className="heroArtwork" aria-hidden="true">
            <img className="heroSmpLogo" src="/assets/aevon-smp.png" alt="" />
            <img className="heroBirdFloat" src="/assets/aevon-bird.png" alt="" />
          </div>
        </div>
      </section>

      <section className="minecraftStatusStrip" aria-label="AevonSMP live server status">
        <div className="minecraftStatusInner">
          <div className="minecraftStatusIdentity">
            <span className={`minecraftDot ${statusLoading ? "checking" : communityStatus?.minecraft?.available === false ? "unavailable" : communityStatus?.minecraft?.online ? "online" : "offline"}`} />
            <strong>{statusLoading ? "Checking…" : communityStatus?.minecraft?.available === false ? "Status unavailable" : communityStatus?.minecraft?.online ? "Online" : "Offline"}</strong>
          </div>
          <button className="minecraftIpButton" type="button" onClick={copyServerIp} title="Copy server IP">
            <Server size={13}/><span>aevonsmp.online</span>{copiedIp ? <Check size={13}/> : <Copy size={13}/>}
          </button>
          <div className="minecraftPlayers">
            <Users size={14}/>
            <span>{statusLoading || communityStatus?.minecraft?.available === false ? "—" : <><b>{communityStatus?.minecraft?.playersOnline ?? 0}</b>{communityStatus?.minecraft?.playersMax ? ` / ${communityStatus.minecraft.playersMax}` : ""}</>} <em>players online</em></span>
          </div>
          <span className="minecraftRefresh">Live • 10s</span>
        </div>
      </section>

      <section id="plugins" className="floatingShopSection">
        <div className="shopPanel">
          <div className="shopTopline">
            <div>
              <span className="sectionKicker">AEVON COLLECTION</span>
              <h2>ALL PLUGINS <Sparkles size={18}/></h2>
              <p>Swipe, scroll, or hit next — the whole shop floats in one effortless selector.</p>
            </div>
            <label className="marketSearch">
              <Search size={17}/>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search plugins..." />
            </label>
          </div>

          {loading && <div className="marketState">Loading marketplace…</div>}
          {!loading && loadError && (
            <div className="marketState error"><AlertTriangle size={22}/><div><strong>Marketplace unavailable</strong><p>{loadError}</p></div></div>
          )}
          {!loading && !loadError && filtered.length === 0 && (
            <div className="marketState"><Package size={22}/><div><strong>{query.trim() ? "No matching plugins" : "No plugins available"}</strong><p>{query.trim() ? "Try another search term." : "There are currently no published plugins."}</p></div></div>
          )}

          {!loading && !loadError && filtered.length > 0 && (
            <div className="carouselFrame">
              <button className="carouselArrow left" onClick={() => move(-1)} disabled={activeIndex === 0} aria-label="Previous plugin"><ChevronLeft/></button>
              <div className="pluginRail" ref={railRef}>
                {filtered.map((plugin, index) => (
                  <article className={index === activeIndex ? "marketPluginCard active" : "marketPluginCard"} key={plugin.id} onClick={() => setActiveIndex(index)}>
                    <div className="marketCardVisual">
                      <div className="marketCardGlow" />
                      <img src="/assets/aevon-bird.png" alt="" />
                      <span className="marketCardInitial">{plugin.name.slice(0, 1).toUpperCase()}</span>
                      {index === 0 && <span className="newBadge">NEW</span>}
                    </div>
                    <div className="marketCardBody">
                      <div className="marketCardHeading"><h3>{plugin.name}</h3><span>v{plugin.version || "1.0.0"}</span></div>
                      <p>{plugin.description || "Official Aevon plugin."}</p>
                      <div className="marketCardBottom">
                        <strong className={Number(plugin.price) > 0 ? "paid" : "free"}>{Number(plugin.price) > 0 ? `₱${Number(plugin.price).toLocaleString()}` : "FREE"}</strong>
                        <Link className="viewPluginBtn" href={`/plugins/${plugin.slug}`}>View Plugin <ArrowRight size={15}/></Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <button className="carouselArrow right" onClick={() => move(1)} disabled={activeIndex === filtered.length - 1} aria-label="Next plugin"><ChevronRight/></button>
            </div>
          )}

          {filtered.length > 1 && !loading && !loadError && (
            <div className="carouselDots" aria-label="Plugin selector">
              {filtered.map((plugin, i) => <button key={plugin.id} className={i === activeIndex ? "active" : ""} onClick={() => goTo(i)} aria-label={`Go to ${plugin.name}`} />)}
            </div>
          )}
        </div>
      </section>

      <section className="marketBenefits">
        <div><span><ShieldCheck/></span><div><strong>Secure & Safe</strong><small>Protected marketplace access</small></div></div>
        <div><span><Zap/></span><div><strong>Optimized</strong><small>Built for server performance</small></div></div>
        <div><span><Headphones/></span><div><strong>Support Ready</strong><small>Your library in one account</small></div></div>
        <div><span><BadgeCheck/></span><div><strong>Premium Quality</strong><small>Official Aevon releases</small></div></div>
      </section>
    </div>
  );
}
