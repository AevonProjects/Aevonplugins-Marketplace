"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Package, ArrowRight, Sparkles } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

type PluginRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  version: string | null;
  price: number;
  status: string;
};

const demoPlugin: PluginRow = {
  id: "demo-alicense",
  name: "ALicense",
  slug: "alicense",
  description: "Advanced item licensing and ownership protection for Minecraft servers.",
  version: "1.1.1",
  price: 0,
  status: "published"
};

export default function MarketplacePage() {
  const [plugins, setPlugins] = useState<PluginRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!supabase) {
        setPlugins([demoPlugin]);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("plugins")
        .select("id,name,slug,description,version,price,status")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error || !data?.length) setPlugins([demoPlugin]);
      else setPlugins(data as PluginRow[]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plugins;
    return plugins.filter(p => `${p.name} ${p.description ?? ""}`.toLowerCase().includes(q));
  }, [plugins, query]);

  return (
    <div className="pageWrap">
      <header className="topbar">
        <div>
          <p className="eyebrow">AEVON PROJECTS</p>
          <h1>Plugin Marketplace</h1>
          <p className="muted">Premium tools built for serious Minecraft communities.</p>
        </div>
        <div className="statusPill"><span /> Supabase {isSupabaseConfigured ? "connected" : "not configured"}</div>
      </header>

      <section className="hero">
        <div>
          <span className="heroBadge"><Sparkles size={15} /> Marketplace V2</span>
          <h2>Build your server with Aevon.</h2>
          <p>Browse official plugins, manage purchases, and keep every license in one account.</p>
        </div>
      </section>

      <div className="searchRow">
        <Search size={18} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search plugins..." />
      </div>

      <section className="grid">
        {loading ? <div className="emptyCard">Loading marketplace…</div> : filtered.map(plugin => (
          <article className="pluginCard" key={plugin.id}>
            <div className="pluginIcon"><Package size={28} /></div>
            <div className="pluginBody">
              <div className="pluginTop">
                <h3>{plugin.name}</h3>
                <span className="version">v{plugin.version || "1.0.0"}</span>
              </div>
              <p>{plugin.description || "Official Aevon plugin."}</p>
              <div className="pluginBottom">
                <strong>{Number(plugin.price) > 0 ? `₱${Number(plugin.price).toLocaleString()}` : "Free"}</strong>
                <button className="primaryBtn">View Plugin <ArrowRight size={16} /></button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
