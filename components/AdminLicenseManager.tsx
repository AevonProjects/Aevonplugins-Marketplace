"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, RefreshCw, Search, ServerCog, ShieldCheck, ShieldOff, Ban, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type LicenseRow = {
  id: string; user_id: string; plugin_id: string; license_key: string; status: string;
  server_id?: string | null; activated_at?: string | null; last_validated_at?: string | null;
  download_count: number; last_download_at?: string | null; created_at: string;
  plugins?: { name?: string; slug?: string; version?: string } | null;
  user?: { id: string; email?: string; nickname?: string; display_name?: string; username?: string; verification_status?: string };
};

export default function AdminLicenseManager() {
  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pluginFilter, setPluginFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const token = useCallback(async () => (await supabase?.auth.getSession()).data.session?.access_token || "", []);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const t = await token();
      const res = await fetch("/api/admin/licenses", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not load licenses.");
      setRows(body.licenses || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load licenses."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const pluginNames = useMemo(() => Array.from(new Set(rows.map(r => r.plugins?.name || "Plugin"))).sort(), [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      const pname = r.plugins?.name || "Plugin";
      if (pluginFilter !== "all" && pname !== pluginFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [pname, r.license_key, r.user?.email, r.user?.nickname, r.user?.display_name, r.user?.username, r.server_id].some(v => String(v || "").toLowerCase().includes(q));
    });
  }, [rows, pluginFilter, statusFilter, search]);

  async function patch(row: LicenseRow, payload: Record<string, unknown>, label: string) {
    if (!confirm(`${label} for ${row.plugins?.name || "this plugin"} license ${row.license_key}?`)) return;
    setBusy(row.id); setError(null);
    try {
      const t = await token();
      const res = await fetch(`/api/admin/licenses/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not update license.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update license."); }
    finally { setBusy(null); }
  }

  return <section className="adminListSection adminLicenseSection">
    <div className="sectionHeading">
      <div><p className="eyebrow">CUSTOMER ACCESS</p><h2><KeyRound size={20}/> Plugin License Manager</h2><p className="muted smallMuted">See every marketplace license by plugin, customer, activation status, downloads, and server binding. You can activate, suspend, revoke, or reset a server activation.</p></div>
      <button className="secondaryBtn" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? "spin" : ""}/> Refresh Licenses</button>
    </div>

    <div className="licenseAdminToolbar">
      <label className="licenseSearch"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search email, nickname, license key, server ID…"/></label>
      <select value={pluginFilter} onChange={e=>setPluginFilter(e.target.value)}><option value="all">All plugins</option>{pluginNames.map(n=><option key={n}>{n}</option>)}</select>
      <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="revoked">Revoked</option></select>
      <span className="licenseCount">{filtered.length} / {rows.length}</span>
    </div>

    {error && <div className="adminInlineError">{error}</div>}
    {loading && !rows.length ? <div className="emptyCard"><Loader2 className="spin" size={18}/> Loading licenses…</div> : !filtered.length ? <div className="emptyCard">No licenses match these filters.</div> : <div className="adminLicenseList">
      {filtered.map(row => {
        const person = row.user?.nickname || row.user?.display_name || row.user?.username || row.user?.email || row.user_id;
        const plugin = Array.isArray(row.plugins) ? (row.plugins as any)[0] : row.plugins;
        return <article className="adminLicenseRow" key={row.id}>
          <div className="adminLicenseIdentity">
            <div className="adminPluginTitleRow"><h3>{plugin?.name || "Plugin"}</h3><span className={`licenseStatus ${row.status}`}>{row.status}</span></div>
            <strong>{person}</strong>{row.user?.email && <small>{row.user.email}</small>}
            <code>{row.license_key}</code>
          </div>
          <div className="adminLicenseFacts">
            <div><span>Plugin version</span><strong>{plugin?.version ? `v${plugin.version}` : "—"}</strong></div>
            <div><span>Downloads</span><strong>{row.download_count || 0}</strong></div>
            <div><span>Activated</span><strong>{row.activated_at ? new Date(row.activated_at).toLocaleString() : "Not yet"}</strong></div>
            <div><span>Last validated</span><strong>{row.last_validated_at ? new Date(row.last_validated_at).toLocaleString() : "Never"}</strong></div>
            <div className="wideFact"><span>Server binding</span><code>{row.server_id || "Not activated"}</code></div>
          </div>
          <div className="adminLicenseActions">
            {row.status !== "active" && <button className="secondaryBtn" disabled={busy===row.id} onClick={()=>patch(row,{status:"active"},"Activate license")}><ShieldCheck size={14}/> Activate</button>}
            {row.status !== "suspended" && <button className="secondaryBtn" disabled={busy===row.id} onClick={()=>patch(row,{status:"suspended"},"Suspend license")}><ShieldOff size={14}/> Suspend</button>}
            {row.status !== "revoked" && <button className="dangerBtn" disabled={busy===row.id} onClick={()=>patch(row,{status:"revoked"},"Revoke license")}><Ban size={14}/> Revoke</button>}
            {row.server_id && <button className="secondaryBtn" disabled={busy===row.id} onClick={()=>patch(row,{resetActivation:true},"Reset server activation")}><ServerCog size={14}/> Reset Server</button>}
          </div>
        </article>;
      })}
    </div>}
  </section>;
}
