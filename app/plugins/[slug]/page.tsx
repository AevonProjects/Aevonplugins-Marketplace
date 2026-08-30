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
  TriangleAlert,
  WalletCards,
  ExternalLink,
  Clock3,
  Copy,
  BookOpen,
  Youtube,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  History,
  Tag,
  Trash2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPluginDisplayTitle } from "@/lib/pluginDisplay";
import { paymentConfig } from "@/lib/paymentConfig";
import PluginReviews from "@/components/PluginReviews";
import PluginUsageStats from "@/components/PluginUsageStats";

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
  description_html?: string | null;
  gallery_images?: string[] | null;
  profile_image_url?: string | null;
  wiki_url?: string | null;
  youtube_url?: string | null;
  discord_url?: string | null;
  paper_versions?: string[] | null;
  purpur_versions?: string[] | null;
};


type PluginVersionRow = {
  id: string;
  version: string;
  release_type: "stable" | "hotfix" | "beta" | "legacy";
  changelog: string | null;
  file_name: string;
  file_size: number | null;
  is_latest: boolean;
  created_at: string;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [gcashOrder, setGcashOrder] = useState<{order_code:string;amount:number;status:string}|null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paypalBusy, setPaypalBusy] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [versions, setVersions] = useState<PluginVersionRow[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionBusy, setVersionBusy] = useState<string | null>(null);
  const [activeServerCount, setActiveServerCount] = useState<number | null>(null);

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
        .select("id,name,slug,description,description_html,gallery_images,profile_image_url,wiki_url,youtube_url,discord_url,paper_versions,purpur_versions,version,price,status,created_at,updated_at")
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

      let resolvedPlugin = pluginData as PluginRow;

      // Version History is the source of truth for the version shown in the
      // plugin title. Always prioritize the newest uploaded published release,
      // even if older listing metadata is still cached.
      const { data: latestReleaseRows } = await supabase
        .from("plugin_versions")
        .select("version,is_latest,created_at")
        .eq("plugin_id", resolvedPlugin.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(1);

      const latestRelease = latestReleaseRows?.[0];
      if (latestRelease?.version) {
        resolvedPlugin = { ...resolvedPlugin, version: String(latestRelease.version) };
      }

      setPlugin(resolvedPlugin);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      setSignedIn(Boolean(user));

      if (user) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        try {
          const meRes = await fetch("/api/account/me", { headers: token ? { Authorization: `Bearer ${token}` } : undefined, cache: "no-store" });
          const meBody = await meRes.json().catch(() => ({}));
          setIsAdmin(Boolean(meRes.ok && meBody?.profile?.role === "admin"));
        } catch {
          setIsAdmin(false);
        }

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


  useEffect(() => {
    if (!plugin?.id || !["alicense", "adiscordall"].includes(plugin.slug)) {
      setActiveServerCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/plugins/${plugin.id}/usage`, { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setActiveServerCount(Number(body?.totals?.activeServers ?? 0));
      } catch {
        if (!cancelled) setActiveServerCount(null);
      }
    })();
    return () => { cancelled = true; };
  }, [plugin?.id, plugin?.slug]);

  useEffect(() => {
    if (!plugin?.id) return;
    let cancelled = false;
    (async () => {
      setVersionsLoading(true);
      try {
        const res = await fetch(`/api/plugins/${plugin.id}/versions`, { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setVersions((body.versions ?? []) as PluginVersionRow[]);
      } finally {
        if (!cancelled) setVersionsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [plugin?.id]);

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

  async function downloadVersion(release: PluginVersionRow) {
    if (!plugin || !supabase || (!owned && !isAdmin)) return;
    setVersionBusy(release.id);
    setActionMessage(null);
    const token = await authToken();
    const res = await fetch(`/api/plugins/${plugin.id}/versions/${release.id}/download`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => ({}));
    setVersionBusy(null);
    if (!res.ok) return setActionMessage(body.error || "Could not download this version.");
    window.location.href = body.url;
  }



  async function deleteVersion(release: PluginVersionRow) {
    if (!plugin || !supabase || !isAdmin) return;
    const label = release.is_latest ? "CURRENT/LATEST resource" : `previous version v${release.version}`;
    const confirmed = window.confirm(`Delete ${label}?\n\nThe JAR file and this release record will be permanently removed. This cannot be undone.`);
    if (!confirmed) return;
    setVersionBusy(release.id);
    setActionMessage(null);
    const token = await authToken();
    const res = await fetch(`/api/admin/plugins/${plugin.id}/versions/${release.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => ({}));
    setVersionBusy(null);
    if (!res.ok) return setActionMessage(body.error || "Could not delete this resource version.");
    setVersions((current) => current.filter((item) => item.id !== release.id).map((item) => ({ ...item, is_latest: item.id === body.promotedVersionId })));
    setActionMessage(release.is_latest ? "Current resource deleted. The newest remaining release was promoted automatically." : `Version v${release.version} was deleted.`);
    if (release.is_latest) window.location.reload();
  }

  async function createGcashOrder() {
    if (!plugin || !supabase) return;
    setPaymentBusy(true);
    setActionMessage(null);
    const token = await authToken();
    const res = await fetch('/api/orders/gcash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pluginId: plugin.id })
    });
    const body = await res.json();
    setPaymentBusy(false);
    if (!res.ok) { setActionMessage(body.error || 'Could not create GCash order.'); return; }
    setGcashOrder(body.order);
  }

  async function copyOrderCode() {
    if (!gcashOrder) return;
    await navigator.clipboard?.writeText(gcashOrder.order_code);
    setActionMessage('Order reference copied.');
  }

  async function startPaypalCheckout() {
    if (!plugin || !supabase || paypalBusy) return;
    setPaypalBusy(true);
    setActionMessage(null);

    try {
      const token = await authToken();
      if (!token) {
        setActionMessage('Please sign in again before using PayPal.');
        return;
      }

      const res = await fetch('/api/orders/paypal/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pluginId: plugin.id })
      });

      let body: { approveUrl?: string; error?: string } = {};
      try {
        body = await res.json();
      } catch {
        body = {};
      }

      if (!res.ok || !body.approveUrl) {
        setActionMessage(body.error || `Could not start PayPal checkout (HTTP ${res.status}).`);
        return;
      }

      // PayPal approval happens on paypal.com. assign() makes the navigation explicit
      // and avoids popup blockers because this runs directly from the button click flow.
      window.location.assign(body.approveUrl);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Could not connect to PayPal. Please try again.');
    } finally {
      setPaypalBusy(false);
    }
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
    <div className="pageWrap pluginDetailWrap pluginResourceView">
      <Link className="backLink resourceBackLink" href="/"><ArrowLeft size={16} /> Back to Marketplace</Link>

      <header className="classicResourceHeader">
        <div className="classicResourceIdentity">
          {plugin.profile_image_url ? <img className="classicPluginProfileImage" src={plugin.profile_image_url} alt={`${plugin.name} profile`} /> : <div className="classicPluginGlyph"><Package size={25}/></div>}
          <div>
            <div className="classicTitleRow">
              <h1>{getPluginDisplayTitle(plugin.name, plugin.version)}</h1>
            </div>
          </div>
        </div>

        <div className="classicHeaderAction">
          {!signedIn ? (
            <Link className="classicDownloadBtn locked" href="/login"><LockKeyhole size={16}/> Login to Access</Link>
          ) : owned ? (
            <button className="classicDownloadBtn" disabled={actionBusy} onClick={downloadPlugin}>
              <Download size={16}/><span>{actionBusy ? "Preparing…" : "Download Now"}</span><small>{plugin.version ? `v${plugin.version}` : "Latest"}</small>
            </button>
          ) : price > 0 ? (
            <button className="classicDownloadBtn purchase" onClick={()=>setShowPayment(true)}><ShoppingCart size={16}/><span>Purchase Plugin</span><small>₱{price.toLocaleString()}</small></button>
          ) : (
            <button className="classicDownloadBtn purchase" disabled={actionBusy} onClick={claimFree}><ShoppingCart size={16}/><span>{actionBusy ? "Adding…" : "Claim Free"}</span><small>Free</small></button>
          )}
        </div>
      </header>

      {actionMessage && <div className="classicActionMessage">{actionMessage}</div>}

      <nav className="classicResourceTabs" aria-label="Plugin navigation">
        <a className="active" href="#overview">Overview</a>
        {plugin.wiki_url && <a href={plugin.wiki_url} target="_blank" rel="noreferrer">Documentation</a>}
        <a href="#reviews">Reviews</a>
        <a href="#versions">Version History</a>
        {["alicense", "adiscordall"].includes(plugin.slug) && <a href="#usage">Usage</a>}
        {plugin.discord_url && <a href={plugin.discord_url} target="_blank" rel="noreferrer">Discussion</a>}
      </nav>

      <div className="classicResourceLayout" id="overview">
        <main className="classicMainColumn">
          <section className="classicOverviewCard">
            <div className="classicMetaGrid">
              <div><span>Latest Version:</span><strong>{plugin.version || "1.0.0"}</strong></div>
              <div><span>Release Status:</span><strong className="classicPublished">Published</strong></div>
              <div><span>Last Update:</span><strong>{new Date(plugin.updated_at).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})}</strong></div>
              <div><span>Marketplace:</span><strong>Aevon Plugins</strong></div>
              <div className="compatibilityMeta"><span>Paper Compatibility:</span><strong>{plugin.paper_versions?.length ? plugin.paper_versions.join(", ") : "Not specified"}</strong></div>
              <div className="compatibilityMeta"><span>Purpur Compatibility:</span><strong>{plugin.purpur_versions?.length ? plugin.purpur_versions.join(", ") : "Not specified"}</strong></div>
            </div>

            {(plugin.gallery_images?.length ?? 0) > 0 && (
              <div className="classicGallery">
                <div className="resourceGalleryFrame">
                  <img key={`${plugin.id}-${galleryIndex}`} className="resourceGalleryImage" src={plugin.gallery_images![galleryIndex]} alt={`${plugin.name} screenshot ${galleryIndex + 1}`} />
                  {plugin.gallery_images!.length > 1 && <>
                    <button className="galleryNav galleryPrev" onClick={()=>setGalleryIndex((galleryIndex-1+plugin.gallery_images!.length)%plugin.gallery_images!.length)} aria-label="Previous image"><ChevronLeft/></button>
                    <button className="galleryNav galleryNext" onClick={()=>setGalleryIndex((galleryIndex+1)%plugin.gallery_images!.length)} aria-label="Next image"><ChevronRight/></button>
                  </>}
                </div>
                {plugin.gallery_images!.length > 1 && <div className="resourceGalleryControls">
                  <span>{galleryIndex + 1} / {plugin.gallery_images!.length}</span>
                  <div className="galleryDots">{plugin.gallery_images!.map((_,i)=><button key={i} className={i===galleryIndex?"active":""} onClick={()=>setGalleryIndex(i)} aria-label={`Show image ${i+1}`}/>)}</div>
                </div>}
              </div>
            )}

            <article className="classicDescription">
              <h2>{plugin.name}</h2>
              {plugin.description_html
                ? <div className="richPluginDescription" dangerouslySetInnerHTML={{__html:plugin.description_html}}/>
                : <p className="richPluginDescription">{plugin.description || "Official Aevon plugin."}</p>}
            </article>
          </section>

          <section className="versionHistoryPanel classicVersionPanel" id="versions">
            <div className="versionHistoryHeader">
              <div>
                <span>RELEASE ARCHIVE</span>
                <h2><History size={19}/> Version History</h2>
                <p>Review every update, hotfix and previous release. Plugin owners can download older versions whenever they need to roll back.</p>
              </div>
              <strong>{versions.length} release{versions.length === 1 ? "" : "s"}</strong>
            </div>

            {versionsLoading ? (
              <div className="versionHistoryEmpty"><LoaderCircle className="spin" size={18}/> Loading release history…</div>
            ) : versions.length === 0 ? (
              <div className="versionHistoryEmpty">No archived releases are available yet.</div>
            ) : (
              <div className="versionReleaseList">
                {versions.map((release) => (
                  <article className={`versionReleaseCard ${release.is_latest ? "latest" : ""}`} key={release.id}>
                    <div className="versionReleaseMain">
                      <div className="versionReleaseTitle">
                        <strong>v{release.version}</strong>
                        {release.is_latest && <span className="latestReleaseBadge">LATEST</span>}
                        <span className={`releaseTypeBadge ${release.release_type}`}><Tag size={11}/>{release.release_type}</span>
                      </div>
                      <time>{new Date(release.created_at).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})}</time>
                      <p>{release.changelog || "No changelog was provided for this release."}</p>
                      <small>{release.file_name}{release.file_size ? ` · ${(release.file_size / 1024 / 1024).toFixed(2)} MB` : ""}</small>
                    </div>
                    <div className="versionReleaseAction adminVersionActions">
                      {owned || isAdmin ? (
                        <button className={release.is_latest ? "primaryBtn" : "secondaryBtn"} disabled={versionBusy === release.id} onClick={() => downloadVersion(release)}>
                          {versionBusy === release.id ? <LoaderCircle className="spin" size={14}/> : <Download size={14}/>} {release.is_latest ? "Download Latest" : "Download"}
                        </button>
                      ) : <span className="versionLocked"><LockKeyhole size={13}/> Purchase required</span>}
                      {isAdmin && (
                        <button className="dangerBtn adminDeleteVersionBtn" disabled={versionBusy === release.id} onClick={() => deleteVersion(release)} title={release.is_latest ? "Delete current resource" : "Delete previous version"}>
                          <Trash2 size={14}/> {release.is_latest ? "Delete Current" : "Delete Version"}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            {owned && versions.some(v => !v.is_latest) && <p className="legacyDownloadWarning"><TriangleAlert size={14}/> Older releases may contain bugs or security issues fixed in newer versions.</p>}
          </section>

          <div id="reviews" className="classicReviewsAnchor">
            <PluginReviews pluginId={plugin.id} owned={owned} signedIn={signedIn} />
          </div>

          {["alicense", "adiscordall"].includes(plugin.slug) && (
            <div className="classicBottomUsage">
              <PluginUsageStats pluginId={plugin.id} />
            </div>
          )}
        </main>

        <aside className="classicSidebar">
          <section className="classicSideCard accentCard">
            <div className="classicCardTitle"><ShieldCheck size={15}/> INFORMATION</div>
            <div className="classicInfoRows">
              <div><span>Plugin:</span><strong>{plugin.name}</strong></div>
              <div><span>Latest Version:</span><strong>{plugin.version || "1.0.0"}</strong></div>
              <div><span>Last Update:</span><strong>{new Date(plugin.updated_at).toLocaleDateString()}</strong></div>
              <div><span>Price:</span><strong>{price > 0 ? `₱${price.toLocaleString()}` : "Free"}</strong></div>
              <div><span>Status:</span><strong className="classicPublished">Published</strong></div>
            </div>
          </section>

          <section className="classicSideCard accentCard latestCard">
            <div className="classicCardTitle"><History size={15}/> VERSION {plugin.version || "1.0.0"}</div>
            <div className="classicInfoRows">
              <div><span>Released:</span><strong>{new Date(plugin.updated_at).toLocaleDateString()}</strong></div>
              <div><span>Downloads:</span><strong>{license?.download_count ?? "—"}</strong></div>
              <div><span>Release:</span><strong>{versions.find(v=>v.is_latest)?.release_type || "stable"}</strong></div>
            </div>
            {owned && <button className="classicMiniDownload" onClick={downloadPlugin} disabled={actionBusy}><Download size={14}/> Download Latest</button>}
          </section>

          {signedIn && owned && license && (
            <section className="classicSideCard accentCard">
              <div className="classicCardTitle"><KeyRound size={15}/> YOUR LICENSE</div>
              <div className="classicInfoRows">
                <div><span>Status:</span><strong className={`licenseStatus ${license.status}`}>{license.status}</strong></div>
                <div className="stacked"><span>License #:</span><code>{license.license_key}</code></div>
                <div><span>Downloads:</span><strong>{license.download_count}</strong></div>
              </div>
            </section>
          )}

          {(plugin.wiki_url || plugin.youtube_url || plugin.discord_url) && (
            <section className="classicSideCard accentCard">
              <div className="classicCardTitle"><ExternalLink size={15}/> RESOURCES</div>
              <div className="classicResourceLinks">
                {plugin.wiki_url && <a href={plugin.wiki_url} target="_blank" rel="noreferrer"><BookOpen size={15}/> Documentation</a>}
                {plugin.youtube_url && <a href={plugin.youtube_url} target="_blank" rel="noreferrer"><Youtube size={15}/> Video Tutorial</a>}
                {plugin.discord_url && <a href={plugin.discord_url} target="_blank" rel="noreferrer"><MessageCircle size={15}/> Discussion / Support</a>}
              </div>
            </section>
          )}
        </aside>
      </div>

      {showPayment && (
        <div className="paymentModalBackdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) setShowPayment(false); }}>
          <div className="paymentModal" role="dialog" aria-modal="true" aria-label="Choose payment method">
            <button className="paymentClose" onClick={() => setShowPayment(false)} aria-label="Close">×</button>
            <div className="paymentModalHeader">
              <WalletCards size={24} />
              <div><span>CHECKOUT</span><h2>Choose Payment Method</h2><p>{plugin.name} · ₱{price.toLocaleString()}</p></div>
            </div>

            {actionMessage && (
              <div className="paymentInlineMessage" role="alert">{actionMessage}</div>
            )}

            {!gcashOrder ? (
              <div className="paymentChoices">
                <button className="paymentChoice gcashChoice" onClick={createGcashOrder} disabled={paymentBusy}>
                  <strong>GCash</strong>
                  <span>Manual verification · Up to 24 hours</span>
                  <small>{paymentBusy ? 'Preparing order…' : 'PAY WITH GCASH'}</small>
                </button>
                <button className="paymentChoice paypalChoice" onClick={startPaypalCheckout} disabled={paypalBusy || paymentBusy}>
                  <strong>PayPal</strong>
                  <span>Automatic verification · Instant access after successful payment</span>
                  <small>{paypalBusy ? 'CONNECTING TO PAYPAL…' : 'PAY WITH PAYPAL'}</small>
                </button>
              </div>
            ) : (
              <div className="gcashInstructions">
                <div className="gcashOrderTop">
                  <div><span>Amount to pay</span><strong>₱{Number(gcashOrder.amount).toLocaleString()}</strong></div>
                  <div><span>Order reference</span><strong className="orderCode">{gcashOrder.order_code}</strong></div>
                </div>

                {(paymentConfig.gcashQrUrl || paymentConfig.gcashAccountName || paymentConfig.gcashNumber) ? (
                  <div className="gcashPayBox">
                    {paymentConfig.gcashQrUrl && <img className="gcashQr" src={paymentConfig.gcashQrUrl} alt="GCash payment QR" />}
                    <div>
                      <span>GCash payment details</span>
                      {paymentConfig.gcashAccountName && <strong>{paymentConfig.gcashAccountName}</strong>}
                      {paymentConfig.gcashNumber && <strong>GCash Mobile: {paymentConfig.gcashNumber}</strong>}
                      <p>Scan the QR code and pay the exact amount shown above.</p>
                      {paymentConfig.gcashNumber && <p><b>Can’t pay using the QR code?</b> You may send the payment manually through GCash to <b>{paymentConfig.gcashNumber}</b> instead.</p>}
                    </div>
                  </div>
                ) : (
                  <div className="gcashConfigNotice">GCash QR/account details have not been configured yet. Keep this order reference and contact staff in Discord.</div>
                )}

                <div className="verificationNotice">
                  <Clock3 size={19} />
                  <div>
                    <strong>Payment verification required</strong>
                    <p>After completing your GCash payment, take a clear screenshot of your payment receipt and join our Discord server. Create a support ticket and submit the receipt together with your order reference. Once your payment has been verified, you will receive a notification and the plugin will become available in <b>My Library</b>.</p>
                    <p><b>Please allow up to 24 hours for GCash payment verification.</b></p>
                  </div>
                </div>

                <div className="paymentActionRow">
                  <button className="secondaryBtn" onClick={copyOrderCode}><Copy size={15}/> Copy Order Reference</button>
                  <a className="primaryBtn" href={paymentConfig.discordInvite} target="_blank" rel="noreferrer">Join Discord & Create Ticket <ExternalLink size={15}/></a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
