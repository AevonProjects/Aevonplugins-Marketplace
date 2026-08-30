"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, RefreshCcw, Server, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

type LicenseRow = {
  id: string;
  license_key: string;
  status: string;
  download_count: number;
  last_download_at?: string | null;
  server_id?: string | null;
  server_ip?: string | null;
  activated_at?: string | null;
  last_validated_at?: string | null;
  plugins?: { name?: string | null; version?: string | null } | null;
};

export default function LicensesPage() {
  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [message, setMessage] = useState("Loading…");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    if (!supabase) return "";
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }, []);

  const load = useCallback(async () => {
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessage("Sign in to view your licenses.");
      return;
    }

    let { data, error: queryError } = await supabase
      .from("licenses")
      .select("id,license_key,status,download_count,last_download_at,server_id,server_ip,activated_at,last_validated_at,plugins(name,version)")
      .order("created_at", { ascending: false });

    // Older databases may not have server_ip yet. Keep the page usable while
    // the included Supabase hotfix is being applied.
    if (queryError && queryError.message.toLowerCase().includes("server_ip")) {
      const fallback = await supabase
        .from("licenses")
        .select("id,license_key,status,download_count,last_download_at,server_id,activated_at,last_validated_at,plugins(name,version)")
        .order("created_at", { ascending: false });
      data = fallback.data as typeof data;
      queryError = fallback.error;
    }

    if (queryError) {
      setMessage("");
      setError(queryError.message);
      return;
    }

    setRows((data ?? []) as unknown as LicenseRow[]);
    setMessage(data?.length ? "" : "No licenses have been assigned to this account yet.");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resetLicense(row: LicenseRow) {
    if (!row.server_id) return;
    const confirmed = window.confirm(
      `Reset the server activation for ${row.plugins?.name || "this plugin"}?\n\nThis will disconnect the current server. The license can then activate on one new server.`
    );
    if (!confirmed) return;

    setBusyId(row.id);
    setError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required.");

      const response = await fetch(`/api/licenses/${row.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resetActivation: true }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Unable to reset this license activation.");

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset this license activation.");
    } finally {
      setBusyId(null);
    }
  }

  function formatDate(value?: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  }

  return (
    <div className="pageWrap">
      <p className="eyebrow">ACCOUNT</p>
      <h1>Licenses</h1>
      <p className="muted">View each purchased plugin, its current server activation, and reset the binding when you move to a different server.</p>

      {message && <div className="emptyCard"><KeyRound size={24}/><span>{message}</span></div>}
      {error && <div className="licenseCustomerError">{error}</div>}

      <div className="customerLicenseList">
        {rows.map((r) => {
          const bound = Boolean(r.server_id);
          return (
            <article className="customerLicenseCard" key={r.id}>
              <div className="customerLicenseHeading">
                <div>
                  <span className="eyebrow">PLUGIN LICENSE</span>
                  <h2>{r.plugins?.name ?? "Plugin"} <small>v{r.plugins?.version || "1.0.0"}</small></h2>
                </div>
                <span className={`licenseStatus licenseStatus-${String(r.status || "unknown").toLowerCase()}`}>{r.status}</span>
              </div>

              <div className="customerLicenseFacts">
                <div><span>License #</span><strong>{r.license_key}</strong></div>
                <div><span>Server Status</span><strong>{bound ? "Bound to one server" : "Ready for activation"}</strong></div>
                <div><span>Server IP</span><strong>{bound ? (r.server_ip || "IP not reported yet") : "—"}</strong></div>
                <div><span>Installation ID</span><strong className="monoFact">{bound ? r.server_id : "—"}</strong></div>
                <div><span>Activated</span><strong>{formatDate(r.activated_at)}</strong></div>
                <div><span>Last Validated</span><strong>{formatDate(r.last_validated_at)}</strong></div>
              </div>

              <div className="customerLicenseFooter">
                <span>{bound ? <><Server size={15}/> Only this server can currently use the license.</> : <><ShieldCheck size={15}/> The next server that validates this license will become its active server.</>}</span>
                <button className="secondaryButton" type="button" disabled={!bound || busyId === r.id} onClick={() => resetLicense(r)}>
                  <RefreshCcw size={15}/>{busyId === r.id ? "Resetting…" : "Reset Server"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
