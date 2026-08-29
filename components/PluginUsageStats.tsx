"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Server, Users, LoaderCircle } from "lucide-react";

type Point = { date: string; servers: number; players: number };
type Payload = {
  totals: { totalServers: number; activeServers: number; uniquePlayers: number };
  series: Point[];
  activeWindowDays: number;
};

function ServerTrendChart({ data }: { data: Point[] }) {
  const width = 900, height = 230, left = 42, right = 18, top = 18, bottom = 32;
  const values = data.map((d) => d.servers);
  const max = Math.max(1, ...values);
  const points = data.map((d, i) => {
    const x = data.length <= 1 ? width / 2 : left + (i * (width - left - right)) / (data.length - 1);
    const y = height - bottom - (d.servers / max) * (height - top - bottom);
    return { x, y, d };
  });
  const path = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const first = data[0]?.date;
  const last = data[data.length - 1]?.date;

  return (
    <div className="serverUsageChartCard">
      <div className="serverUsageChartHeader">
        <div>
          <span>SERVER ADOPTION TREND</span>
          <strong>Servers currently using ALicense</strong>
        </div>
        <small>Peak {max.toLocaleString()} server{max === 1 ? "" : "s"}</small>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="ALicense server usage over the last 30 days">
        <line x1={left} y1={height-bottom} x2={width-right} y2={height-bottom} className="usageAxis" />
        <line x1={left} y1={top} x2={left} y2={height-bottom} className="usageAxis" />
        <polyline points={path} className="usageLine servers" fill="none" />
        {points.map(({x,y,d}) => (
          <circle key={d.date} cx={x} cy={y} r="3.2" className="usageDot servers">
            <title>{`${d.date}: ${d.servers.toLocaleString()} server${d.servers === 1 ? "" : "s"}`}</title>
          </circle>
        ))}
      </svg>
      <div className="usageChartDates">
        <span>{first ? new Date(`${first}T00:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"}) : ""}</span>
        <span>Last 30 days</span>
        <span>{last ? new Date(`${last}T00:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"}) : ""}</span>
      </div>
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

  const hasActivity = useMemo(() => Boolean(data && data.series.some((p) => p.servers > 0)), [data]);

  return (
    <section className="pluginUsagePanel pluginUsageBottom" id="usage">
      <div className="pluginUsageHeader">
        <div>
          <span>LIVE PLUGIN ADOPTION</span>
          <h2><Activity size={19}/> ALicense Server Usage</h2>
          <p>Tracks anonymous, successfully licensed ALicense server installations. A server restart does not create another server count.</p>
        </div>
      </div>
      {loading ? <div className="usageState"><LoaderCircle className="spin" size={18}/> Loading server usage…</div> : error ? <div className="usageState">{error}</div> : data ? <>
        <div className="usageStatGrid">
          <div><Activity size={18}/><span>Currently Active</span><strong>{data.totals.activeServers.toLocaleString()}</strong><small>Validated in the last {data.activeWindowDays} days</small></div>
          <div><Server size={18}/><span>Total Servers</span><strong>{data.totals.totalServers.toLocaleString()}</strong><small>Unique licensed installations</small></div>
          <div><Users size={18}/><span>Unique Players Seen</span><strong>{data.totals.uniquePlayers.toLocaleString()}</strong><small>Anonymous hashed player count</small></div>
        </div>
        {hasActivity ? <ServerTrendChart data={data.series}/> : <div className="usageState">The server graph will begin filling automatically after licensed ALicense servers report usage.</div>}
      </> : null}
    </section>
  );
}
