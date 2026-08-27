"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Download,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Package,
  ShieldCheck,
  ShoppingCart,
  TriangleAlert
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
  created_at: string;
  updated_at: string;
};

type AccessRow = {
  id: string;
  access_type: "purchase" | "grant" | "admin";
  created_at: string;
};

type LicenseRow = {
  id: string;
  license_key: string;
  status: "active" | "suspended" | "revoked";
  download_count: number;
  last_download_at: string | null;
  created_at: string;
};

export default function PluginDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;

  const [plugin, setPlugin] = useState<PluginRow | null>(null);
  const [access, setAccess] = useState<AccessRow | null>(null);
  const [license, setLicense] = useState<LicenseRow | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlugin() {
      if (!slug || !supabase) {
        setError("Marketplace database is not configured.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data: pluginData, error: pluginError } = await supabase
        .from("plugins")
        .select("id,name,slug,description,version,price,status,created_at,updated_at")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();

      if (pluginError) {
        console.error("Failed to load plugin:", pluginError);
        setError("We couldn't load this plugin right now.");
        setLoading(false);
        return;
      }

      if (!pluginData) {
        setError("This plugin is not available or is currently unpublished.");
        setLoading(false);
        return;
      }

      const resolvedPlugin = pluginData as PluginRow;
      setPlugin(resolvedPlugin);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      setSignedIn(Boolean(user));

      if (user) {
        const [{ data: accessData }, { data: licenseData }] = await Promise.all([
          supabase
            .from("user_plugins")
            .select("id,access_type,created_at")
            .eq("user_id", user.id)
            .eq("plugin_id", resolvedPlugin.id)
            .maybeSingle(),
          supabase
            .from("licenses")
            .select("id,license_key,status,download_count,last_download_at,created_at")
            .eq("user_id", user.id)
            .eq("plugin_id", resolvedPlugin.id)
            .maybeSingle()
        ]);

        setAccess((accessData as AccessRow | null) ?? null);
        setLicense((licenseData as LicenseRow | null) ?? null);
      }

      setLoading(false);
    }

    loadPlugin();
  }, [slug]);


  async function authToken() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function claimFree() {
    if (!plugin || !supabase) return;
    setActionBusy(true); setActionMessage(null);
    const token = await authToken();
    const res = await fetch(`/api/plugins/${plugin.id}/claim`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json(); setActionBusy(false);
    if (!res.ok) return setActionMessage(body.error || "Could not claim plugin.");
    setActionMessage("Plugin added to your library."); window.location.reload();
  }

  async function downloadPlugin() {
    if (!plugin || !supabase) return;
    setActionBusy(true); setActionMessage(null);
    const token = await authToken();
    const res = await fetch(`/api/plugins/${plugin.id}/download`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json(); setActionBusy(false);
    if (!res.ok) return setActionMessage(body.error || "Could not start download.");
    window.location.href = body.url;
  }

  if (loading) {
    return (
      <div className="pageWrap pluginDetailWrap">
        <div className="detailStateCard">
          <LoaderCircle className="spin" size={24} />
          <div>
            <strong>Loading plugin…</strong>
            <p>Fetching the latest marketplace information.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !plugin) {
    return (
      <div className="pageWrap pluginDetailWrap">
        <Link className="backLink" href="/"><ArrowLeft size={16} /> Back to Marketplace</Link>
        <div className="detailStateCard errorState">
          <TriangleAlert size={24} />
          <div>
            <strong>Plugin unavailable</strong>
            <p>{error || "This plugin could not be found."}</p>
          </div>
        </div>
      </div>
    );
  }

  const owned = Boolean(access);
  const price = Number(plugin.price || 0);

  return (
    <div className="pageWrap pluginDetailWrap">
      <Link className="backLink" href="/"><ArrowLeft size={16} /> Back to Marketplace</Link>

      <section className="pluginDetailHero">
        <div className="pluginDetailIcon"><Package size={38} /></div>
        <div className="pluginDetailIntro">
          <div className="detailBadges">
            <span className="version">v{plugin.version || "1.0.0"}</span>
            <span className="statusBadge published"><BadgeCheck size={12} /> Published</span>
          </div>
          <h1>{plugin.name}</h1>
          <p>{plugin.description || "Official Aevon plugin."}</p>
        </div>
        <div className="detailPriceCard">
          <span>Price</span>
          <strong>{price > 0 ? `₱${price.toLocaleString()}` : "Free"}</strong>
        </div>
      </section>

      <div className="detailGrid">
        <section className="detailPanel">
          <div className="detailSectionTitle">
            <ShieldCheck size={19} />
            <div>
              <h2>Plugin Access</h2>
              <p>Your marketplace ownership and license status.</p>
            </div>
          </div>

          {!signedIn ? (
            <div className="accessState">
              <LockKeyhole size={22} />
              <div>
                <strong>Sign in to check access</strong>
                <p>Log in to view ownership, licenses, and future downloads for this plugin.</p>
              </div>
              <Link className="primaryBtn" href="/login">Login</Link>
            </div>
          ) : owned ? (
            <div className="accessState successAccess">
              <BadgeCheck size={22} />
              <div>
                <strong>You own this plugin</strong>
                <p>Access type: {access?.access_type || "assigned"}</p>
              </div>
              <span className="ownedPill">Owned</span>
            </div>
          ) : (
            <div className="accessState">
              <ShoppingCart size={22} />
              <div>
                <strong>{price > 0 ? "Not purchased yet" : "Access not assigned yet"}</strong>
                <p>{price > 0 ? "Secure checkout will be connected in the next marketplace stage." : "Free-plugin claiming will be connected in the next marketplace stage."}</p>
              </div>
              {price > 0 ? <button className="primaryBtn" disabled>Purchase Coming Soon</button> : <button className="primaryBtn" onClick={claimFree} disabled={actionBusy}>{actionBusy ? "Claiming…" : "Add to Library"}</button>}
            </div>
          )}

          {signedIn && owned && (
            <div className="licenseDetailBox">
              <div className="licenseDetailTitle"><KeyRound size={18} /><strong>License</strong></div>
              {license ? (
                <div className="licenseDetailGrid">
                  <div><span>Status</span><strong className={`licenseStatus ${license.status}`}>{license.status}</strong></div>
                  <div><span>License Key</span><code>{license.license_key}</code></div>
                  <div><span>Downloads</span><strong>{license.download_count}</strong></div>
                  <div><span>Last Download</span><strong>{license.last_download_at ? new Date(license.last_download_at).toLocaleString() : "Never"}</strong></div>
                </div>
              ) : (
                <p className="muted licenseEmpty">Ownership exists, but no license record has been issued yet.</p>
              )}
            </div>
          )}

          {actionMessage && <p className="muted">{actionMessage}</p>}
          <button className="downloadBtn" disabled={!owned || actionBusy} onClick={downloadPlugin}>
            <Download size={18} /> {actionBusy ? "Please wait…" : owned ? "Download Plugin" : "Own this plugin to download"}
          </button>
        </section>

        <aside className="detailPanel detailsAside">
          <h2>Plugin Details</h2>
          <div className="detailFacts">
            <div><span>Name</span><strong>{plugin.name}</strong></div>
            <div><span>Version</span><strong>{plugin.version || "1.0.0"}</strong></div>
            <div><span>Slug</span><code>{plugin.slug}</code></div>
            <div><span>Status</span><strong>Published</strong></div>
            <div><span>Updated</span><strong>{new Date(plugin.updated_at).toLocaleDateString()}</strong></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
