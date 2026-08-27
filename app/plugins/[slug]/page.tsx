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
  ChevronRight
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { paymentConfig } from "@/lib/paymentConfig";

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
  wiki_url?: string | null;
  youtube_url?: string | null;
  discord_url?: string | null;
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
  const [showPayment, setShowPayment] = useState(false);
  const [gcashOrder, setGcashOrder] = useState<{order_code:string;amount:number;status:string}|null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

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
        .select("id,name,slug,description,description_html,gallery_images,wiki_url,youtube_url,discord_url,version,price,status,created_at,updated_at")
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

      {(plugin.gallery_images?.length ?? 0) > 0 && (
        <section className="pluginGallerySection">
          <div className="pluginGalleryFrame">
            <img src={plugin.gallery_images![galleryIndex]} alt={`${plugin.name} screenshot ${galleryIndex + 1}`} />
            {plugin.gallery_images!.length > 1 && <>
              <button className="galleryNav galleryPrev" onClick={()=>setGalleryIndex((galleryIndex-1+plugin.gallery_images!.length)%plugin.gallery_images!.length)} aria-label="Previous image"><ChevronLeft/></button>
              <button className="galleryNav galleryNext" onClick={()=>setGalleryIndex((galleryIndex+1)%plugin.gallery_images!.length)} aria-label="Next image"><ChevronRight/></button>
            </>}
          </div>
          <div className="galleryDots">{plugin.gallery_images!.map((_,i)=><button key={i} className={i===galleryIndex?"active":""} onClick={()=>setGalleryIndex(i)} aria-label={`Show image ${i+1}`}/>)}</div>
        </section>
      )}

      <section className="pluginFullDescription detailPanel">
        <div className="detailSectionTitle"><Package size={19}/><div><h2>About {plugin.name}</h2><p>Complete plugin information and features.</p></div></div>
        {plugin.description_html ? <div className="richPluginDescription" dangerouslySetInnerHTML={{__html:plugin.description_html}}/> : <p className="richPluginDescription">{plugin.description || "Official Aevon plugin."}</p>}
      </section>

      {(plugin.wiki_url || plugin.youtube_url || plugin.discord_url) && <section className="pluginResourceLinks">
        {plugin.wiki_url && <a href={plugin.wiki_url} target="_blank" rel="noreferrer"><BookOpen size={19}/><span><strong>Plugin Wiki</strong><small>Documentation & commands</small></span><ExternalLink size={14}/></a>}
        {plugin.youtube_url && <a href={plugin.youtube_url} target="_blank" rel="noreferrer"><Youtube size={19}/><span><strong>YouTube Tutorial</strong><small>Watch the setup guide</small></span><ExternalLink size={14}/></a>}
        {plugin.discord_url && <a href={plugin.discord_url} target="_blank" rel="noreferrer"><MessageCircle size={19}/><span><strong>Discord</strong><small>Support & community</small></span><ExternalLink size={14}/></a>}
      </section>}

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
                <p>{price > 0 ? "Choose a payment method below to purchase this plugin." : "Free-plugin claiming will be connected in the next marketplace stage."}</p>
              </div>
              {price > 0 ? <button className="primaryBtn" onClick={() => setShowPayment(true)}>Choose Payment</button> : <button className="primaryBtn" onClick={claimFree} disabled={actionBusy}>{actionBusy ? "Claiming…" : "Add to Library"}</button>}
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

          {actionMessage && <p className="muted actionMessage">{actionMessage}</p>}

          {!signedIn ? (
            <button className="pluginActionBtn lockedAction" disabled>
              <LockKeyhole size={18} /> LOGIN / REGISTER TO DOWNLOAD
            </button>
          ) : owned ? (
            <button className="pluginActionBtn ownedDownloadAction" disabled={actionBusy} onClick={downloadPlugin}>
              <Download size={18} /> {actionBusy ? "PREPARING DOWNLOAD…" : "DOWNLOAD"}
            </button>
          ) : price > 0 ? (
            <button
              className="pluginActionBtn purchaseAction"
              disabled={actionBusy}
              onClick={() => setShowPayment(true)}
            >
              <ShoppingCart size={18} /> PURCHASE PLUGIN
            </button>
          ) : (
            <button className="pluginActionBtn purchaseAction" disabled={actionBusy} onClick={claimFree}>
              <ShoppingCart size={18} /> {actionBusy ? "ADDING TO LIBRARY…" : "CLAIM FREE PLUGIN"}
            </button>
          )}
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


      {showPayment && (
        <div className="paymentModalBackdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) setShowPayment(false); }}>
          <div className="paymentModal" role="dialog" aria-modal="true" aria-label="Choose payment method">
            <button className="paymentClose" onClick={() => setShowPayment(false)} aria-label="Close">×</button>
            <div className="paymentModalHeader">
              <WalletCards size={24} />
              <div><span>CHECKOUT</span><h2>Choose Payment Method</h2><p>{plugin.name} · ₱{price.toLocaleString()}</p></div>
            </div>

            {!gcashOrder ? (
              <div className="paymentChoices">
                <button className="paymentChoice gcashChoice" onClick={createGcashOrder} disabled={paymentBusy}>
                  <strong>GCash</strong>
                  <span>Manual verification · Up to 24 hours</span>
                  <small>{paymentBusy ? 'Preparing order…' : 'PAY WITH GCASH'}</small>
                </button>
                <button className="paymentChoice paypalChoice" onClick={() => setActionMessage('PayPal automatic checkout is the next payment integration step.')} disabled>
                  <strong>PayPal</strong>
                  <span>Automatic verification · Instant access</span>
                  <small>COMING NEXT</small>
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
                      {paymentConfig.gcashNumber && <strong>{paymentConfig.gcashNumber}</strong>}
                      <p>Pay the exact amount shown above before submitting your receipt for verification.</p>
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
