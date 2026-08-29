"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search, Package, ArrowRight, Sparkles, AlertTriangle, ChevronLeft, ChevronRight,
  ShieldCheck, Zap, Headphones, BadgeCheck
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPluginDisplayTitle } from "@/lib/pluginDisplay";

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
                      <div className="marketCardHeading"><h3>{getPluginDisplayTitle(plugin.name, plugin.version)}</h3></div>
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
