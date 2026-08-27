"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Package, ArrowRight, Sparkles, AlertTriangle } from "lucide-react";
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

export default function MarketplacePage() {
  const [plugins, setPlugins] = useState<PluginRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    return plugins.filter((p) =>
      `${p.name} ${p.description ?? ""}`.toLowerCase().includes(q)
    );
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
        {loading && <div className="emptyCard">Loading marketplace…</div>}

        {!loading && loadError && (
          <div className="emptyCard">
            <AlertTriangle size={22} />
            <div>
              <strong>Marketplace unavailable</strong>
              <p>{loadError}</p>
            </div>
          </div>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="emptyCard">
            <Package size={22} />
            <div>
              <strong>{query.trim() ? "No matching plugins" : "No plugins available"}</strong>
              <p>{query.trim() ? "Try another search term." : "There are currently no published plugins."}</p>
            </div>
          </div>
        )}

        {!loading && !loadError && filtered.map(plugin => (
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
