"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Server, Users, LoaderCircle } from "lucide-react";

type Point = { date: string; servers: number; players: number };
type Payload = {
  totals: { totalServers: number; activeServers: number; uniquePlayers: number };
  series: Point[];
  activeWindowDays: number;
};

function MiniLineChart({ data, field, label }: { data: Point[]; field: "servers" | "players"; label: string }) {
  const width = 620, height = 170, pad = 18;
  const values = data.map((d) => d[field]);
  const max = Math.max(1, ...values);
  const points = data.map((d, i) => {
    const x = data.length <= 1 ? width / 2 : pad + (i * (width - pad * 2)) / (data.length - 1);
    const y = height - pad - (d[field] / max) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const first = data[0]?.date;
  const last = data[data.length - 1]?.date;
  return (
    <div className="usageChartCard">
      <div className="usageChartTop"><strong>{label}</strong><span>Peak {max.toLocaleString()}</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} usage over the last 30 days`}>
        <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} className="usageAxis" />
        <line x1={pad} y1={pad} x2={pad} y2={height-pad} className="usageAxis" />
        <polyline points={points} className={`usageLine ${field}`} fill="none" />
        {data.map((d, i) => {
          const [x, y] = points.split(" ")[i].split(",").map(Number);
          return <circle key={`${field}-${d.date}`} cx={x} cy={y} r="2.8" className={`usageDot ${field}`}><title>{`${d.date}: ${d[field].toLocaleString()}`}</title></circle>;
        })}
      </svg>
      <div className="usageChartDates"><span>{first ? new Date(`${first}T00:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"}) : ""}</span><span>Last 30 days</span><span>{last ? new Date(`${last}T00:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"}) : ""}</span></div>
    </div>
  );
}

export default function PluginUsageStats({ pluginId }: { pluginId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`/api/plugins/${pluginId}/usage`, { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Could not load usage statistics.");
        if (!cancelled) setData(body as Payload);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load usage statistics.");
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [pluginId]);

  const hasActivity = useMemo(() => Boolean(data && (data.totals.totalServers || data.totals.uniquePlayers)), [data]);

  return (
    <section className="pluginUsagePanel" id="usage">
      <div className="pluginUsageHeader">
        <div><span>LIVE ADOPTION</span><h2><Activity size={19}/> ALicense Usage</h2><p>Anonymous marketplace telemetry from valid ALicense installations. Player identities are hashed before leaving the Minecraft server.</p></div>
      </div>
      {loading ? <div className="usageState"><LoaderCircle className="spin" size={18}/> Loading usage statistics…</div> : error ? <div className="usageState">{error}</div> : data ? <>
        <div className="usageStatGrid">
          <div><Server size={18}/><span>Total Servers</span><strong>{data.totals.totalServers.toLocaleString()}</strong></div>
          <div><Activity size={18}/><span>Active Servers</span><strong>{data.totals.activeServers.toLocaleString()}</strong><small>Seen in the last {data.activeWindowDays} days</small></div>
          <div><Users size={18}/><span>Unique Players</span><strong>{data.totals.uniquePlayers.toLocaleString()}</strong><small>Anonymous unique player count</small></div>
        </div>
        {hasActivity ? <div className="usageCharts"><MiniLineChart data={data.series} field="servers" label="Servers using ALicense"/><MiniLineChart data={data.series} field="players" label="Unique players seen"/></div> : <div className="usageState">Usage data will appear here after licensed ALicense servers begin reporting.</div>}
      </> : null}
    </section>
  );
}
