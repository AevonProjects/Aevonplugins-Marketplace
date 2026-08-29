"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import RichTextEditor from "@/components/RichTextEditor";
import AdminVerificationPanel from "@/components/AdminVerificationPanel";

type PluginRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  version: string | null;
  price: number;
  status: "draft" | "published" | string;
  created_at: string;
  updated_at: string;
  file_name?: string | null;
  file_path?: string | null;
  file_size?: number | null;
  description_html?: string | null;
  gallery_images?: string[] | null;
  wiki_url?: string | null;
  youtube_url?: string | null;
  discord_url?: string | null;
};

type OrderRow = {
  id: string;
  order_code: string;
  customer_email: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  created_at: string;
  plugin_id: string;
  plugins?: { name?: string } | null;
};

type Notice = { type: "success" | "error" | "info"; text: string } | null;

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminPage() {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState<Notice>({ type: "info", text: "Checking admin access…" });
  const [plugins, setPlugins] = useState<PluginRow[]>([]);
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderBusy, setOrderBusy] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [releaseType, setReleaseType] = useState<"stable" | "hotfix" | "beta" | "legacy">("stable");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [wikiUrl, setWikiUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [discordUrl, setDiscordUrl] = useState("");
  const [jarFile, setJarFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<(File | null)[]>([null, null, null]);
  const [price, setPrice] = useState("0");
  const [status, setStatus] = useState<"draft" | "published">("published");

  const editingPlugin = useMemo(
    () => plugins.find((plugin) => plugin.id === editingId) ?? null,
    [editingId, plugins]
  );

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName("");
    setSlug("");
    setDescription("");
    setDescriptionHtml("");
    setVersion("1.0.0");
    setReleaseType("stable");
    setReleaseNotes("");
    setWikiUrl(""); setYoutubeUrl(""); setDiscordUrl("");
    setJarFile(null); setGalleryFiles([null, null, null]);
    setPrice("0");
    setStatus("published");
  }, []);

  const loadPlugins = useCallback(async () => {
    if (!supabase) return;
    setLoadingPlugins(true);
    const { data, error } = await supabase
      .from("plugins")
      .select("id,name,slug,description,description_html,version,price,status,created_at,updated_at,file_name,file_path,file_size,gallery_images,wiki_url,youtube_url,discord_url")
      .order("created_at", { ascending: false });

    setLoadingPlugins(false);
    if (error) {
      setNotice({ type: "error", text: `Could not load plugins: ${error.message}` });
      return;
    }
    setPlugins((data ?? []) as PluginRow[]);
  }, []);

  const loadOrders = useCallback(async () => {
    if (!supabase) return;
    setLoadingOrders(true);
    const { data, error } = await supabase
      .from("marketplace_orders")
      .select("id,order_code,customer_email,amount,currency,payment_method,status,created_at,plugin_id,plugins(name)")
      .eq("payment_method", "gcash")
      .order("created_at", { ascending: false })
      .limit(100);
    setLoadingOrders(false);
    if (error) {
      setNotice({ type: "error", text: `Could not load payment orders: ${error.message}` });
      return;
    }
    setOrders((data ?? []) as unknown as OrderRow[]);
  }, []);

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setNotice({ type: "error", text: "Supabase is not configured." });
        setChecking(false);
        return;
      }

      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        setNotice({ type: "error", text: "Sign in with your admin account first." });
        setChecking(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const roleResponse = await fetch("/api/account/me", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      });
      const rolePayload = await roleResponse.json().catch(() => ({}));

      if (!roleResponse.ok || rolePayload?.profile?.role !== "admin") {
        setNotice({ type: "error", text: rolePayload?.error || "This account does not have admin access." });
        setChecking(false);
        return;
      }

      setAllowed(true);
      setChecking(false);
      setNotice(null);
      await Promise.all([loadPlugins(), loadOrders()]);
    })();
  }, [loadPlugins, loadOrders]);

  function sanitizeRichHtml(html: string) {
    const root = document.createElement("div"); root.innerHTML = html;
    root.querySelectorAll("script,iframe,object,embed,link,meta,style").forEach((el)=>el.remove());
    root.querySelectorAll("*").forEach((el)=>{
      for (const attr of Array.from(el.attributes)) {
        const n=attr.name.toLowerCase(); const v=attr.value.trim().toLowerCase();
        if(n.startsWith("on") || n==="srcdoc" || ((n==="href"||n==="src") && v.startsWith("javascript:"))) el.removeAttribute(attr.name);
      }
    });
    return root.innerHTML;
  }
  function plainFromHtml(html: string) {
    const el = document.createElement("div"); el.innerHTML = html; return (el.textContent || "").trim();
  }

  async function validateImage(file: File) {
    if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} is larger than 5 MB.`);
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload=()=>resolve(i); i.onerror=reject; i.src=url; });
      if (img.naturalWidth < 500 || img.naturalHeight < 500) throw new Error(`${file.name} must be at least 500×500 pixels.`);
    } finally { URL.revokeObjectURL(url); }
  }

  async function uploadMedia(pluginId: string, file: File) {
    if (!supabase) throw new Error("Supabase is not configured.");
    await validateImage(file);
    const {data:s}=await supabase.auth.getSession(); const token=s.session?.access_token;
    const prep=await fetch(`/api/admin/plugins/${pluginId}/media-upload-url`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({fileName:file.name,fileSize:file.size,fileType:file.type})});
    const pj=await prep.json(); if(!prep.ok) throw new Error(pj.error||"Could not prepare image upload.");
    const up=await supabase.storage.from("plugin-media").uploadToSignedUrl(pj.path,pj.token,file,{contentType:file.type});
    if(up.error) throw up.error;
    return supabase.storage.from("plugin-media").getPublicUrl(pj.path).data.publicUrl;
  }

  async function uploadJarById(pluginId: string, pluginName: string, file: File, releaseVersion: string, kind: string, notes: string) {
    if (!supabase) throw new Error("Supabase is not configured.");
    if (!file.name.toLowerCase().endsWith(".jar")) throw new Error("Please select a .jar plugin file.");
    const {data:s}=await supabase.auth.getSession(); const token=s.session?.access_token;
    const prep=await fetch(`/api/admin/plugins/${pluginId}/upload-url`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({fileName:file.name,fileSize:file.size,version:releaseVersion})});
    const pj=await prep.json(); if(!prep.ok) throw new Error(pj.error||"Could not prepare JAR upload.");
    const up=await supabase.storage.from("plugin-files").uploadToSignedUrl(pj.path,pj.token,file,{contentType:"application/java-archive"}); if(up.error) throw up.error;
    const save=await fetch(`/api/admin/plugins/${pluginId}/file`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({path:pj.path,fileName:file.name,fileSize:file.size,version:releaseVersion,releaseType:kind,changelog:notes})});
    const sj=await save.json(); if(!save.ok) throw new Error(sj.error||`Could not save ${pluginName} JAR metadata.`);
  }

  async function submitPlugin(e: FormEvent) {
    e.preventDefault();
    if (!supabase || saving) return;
    const normalizedSlug = makeSlug(slug || name);
    if (!normalizedSlug) { setNotice({ type: "error", text: "Please enter a valid plugin name or slug." }); return; }
    const existingImages = editingPlugin?.gallery_images ?? [];
    const futureImageCount = [0,1,2].filter((i) => Boolean(galleryFiles[i] || existingImages[i])).length;
    if (status === "published" && futureImageCount < 3) { setNotice({type:"error",text:"Published plugins require 3 carousel images."}); return; }
    if (status === "published" && !editingPlugin?.file_name && !jarFile) { setNotice({type:"error",text:"Published plugins require a JAR file."}); return; }
    if (editingPlugin?.file_name && jarFile && version.trim() === (editingPlugin.version ?? "").trim()) { setNotice({type:"error",text:"A new JAR must use a new version number so the current release remains available in Version History."}); return; }
    if (editingPlugin?.file_name && !jarFile && version.trim() !== (editingPlugin.version ?? "").trim()) { setNotice({type:"error",text:"Upload the new JAR when changing the plugin version. Version numbers are tied to releases."}); return; }
    if (jarFile && editingPlugin?.file_name && !releaseNotes.trim()) { setNotice({type:"error",text:"Please add release notes/changelog for the new version."}); return; }
    try {
      for (const f of galleryFiles) if (f) await validateImage(f);
      setSaving(true); setNotice({ type: "info", text: editingId ? "Saving plugin content and uploads…" : "Creating plugin and uploading content…" });
      const safeHtml = sanitizeRichHtml(descriptionHtml);
      const plain = plainFromHtml(safeHtml) || description.trim();
      const payload = { name:name.trim(), slug:normalizedSlug, description:plain.slice(0,1000), description_html:safeHtml.trim(), version:editingPlugin ? (editingPlugin.version ?? version.trim()) : version.trim(), price:Number(price)||0, status, wiki_url:wikiUrl.trim()||null, youtube_url:youtubeUrl.trim()||null, discord_url:discordUrl.trim()||null, updated_at:new Date().toISOString() };
      let pluginId = editingId;
      if (editingId) { const r=await supabase.from("plugins").update(payload).eq("id",editingId); if(r.error) throw r.error; }
      else { const r=await supabase.from("plugins").insert(payload).select("id").single(); if(r.error) throw r.error; pluginId=r.data.id; }
      if (!pluginId) throw new Error("Could not determine plugin ID.");
      if (jarFile) await uploadJarById(pluginId, name.trim(), jarFile, version.trim(), releaseType, releaseNotes.trim() || (editingPlugin?.file_name ? "" : "Initial release."));
      if (galleryFiles.some(Boolean)) {
        const urls:string[]=[];
        for (let i=0;i<3;i++) { const f=galleryFiles[i]; if(f) urls[i]=await uploadMedia(pluginId,f); else if(existingImages[i]) urls[i]=existingImages[i]; }
        const r=await supabase.from("plugins").update({gallery_images:urls.filter(Boolean),updated_at:new Date().toISOString()}).eq("id",pluginId); if(r.error) throw r.error;
      }
      setNotice({type:"success",text:editingId?"Plugin listing updated successfully.":"Plugin created and uploaded successfully."});
      resetForm(); await loadPlugins();
    } catch (err:any) { const duplicate=err?.code==="23505"; setNotice({type:"error",text:duplicate?`A plugin with the slug “${normalizedSlug}” already exists.`:(err?.message||"Could not save plugin.")}); }
    finally { setSaving(false); }
  }

  function beginEdit(plugin: PluginRow) {
    setEditingId(plugin.id);
    setName(plugin.name);
    setSlug(plugin.slug);
    setDescription(plugin.description ?? "");
    setDescriptionHtml(plugin.description_html || plugin.description || "");
    setVersion(plugin.version ?? "1.0.0");
    setReleaseType("stable");
    setReleaseNotes("");
    setWikiUrl(plugin.wiki_url ?? ""); setYoutubeUrl(plugin.youtube_url ?? ""); setDiscordUrl(plugin.discord_url ?? "");
    setJarFile(null); setGalleryFiles([null,null,null]);
    setPrice(String(plugin.price ?? 0));
    setStatus(plugin.status === "published" ? "published" : "draft");
    setNotice({ type: "info", text: `Editing ${plugin.name}.` });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleStatus(plugin: PluginRow) {
    if (!supabase) return;
    const nextStatus = plugin.status === "published" ? "draft" : "published";
    setNotice({
      type: "info",
      text: `${nextStatus === "published" ? "Publishing" : "Unpublishing"} ${plugin.name}…`,
    });

    const { error } = await supabase
      .from("plugins")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", plugin.id);

    if (error) {
      setNotice({ type: "error", text: error.message });
      return;
    }

    const { error: releaseVisibilityError } = await supabase
      .from("plugin_versions")
      .update({ is_published: nextStatus === "published" })
      .eq("plugin_id", plugin.id);
    if (releaseVisibilityError) {
      setNotice({ type: "error", text: `Plugin status changed, but version visibility could not be synchronized: ${releaseVisibilityError.message}` });
      return;
    }

    setNotice({
      type: "success",
      text: `${plugin.name} is now ${nextStatus}.`,
    });
    await loadPlugins();
  }

  async function deletePlugin(plugin: PluginRow) {
    if (!supabase) return;
    const confirmed = window.confirm(
      `Delete ${plugin.name}?\n\nThis removes the marketplace plugin record. This action cannot be undone.`
    );
    if (!confirmed) return;

    setNotice({ type: "info", text: `Deleting ${plugin.name}…` });
    const { error } = await supabase.from("plugins").delete().eq("id", plugin.id);

    if (error) {
      setNotice({ type: "error", text: error.message });
      return;
    }

    if (editingId === plugin.id) resetForm();
    setNotice({ type: "success", text: `${plugin.name} was deleted.` });
    await loadPlugins();
  }


  function prepareNewRelease(plugin: PluginRow) {
    beginEdit(plugin);
    setReleaseType("stable");
    setReleaseNotes("");
    setNotice({ type: "info", text: `Preparing a new release for ${plugin.name}. Enter a new version, changelog, and choose the new JAR.` });
  }

  async function reviewOrder(order: OrderRow, action: "approve" | "reject") {
    if (!supabase || orderBusy) return;
    if (action === "approve" && !window.confirm(`Approve ${order.order_code}?\n\nOnly approve after you have verified the GCash receipt in Discord.`)) return;
    let note = "";
    if (action === "reject") {
      note = window.prompt("Optional rejection note:") || "";
      if (!window.confirm(`Reject ${order.order_code}?`)) return;
    }
    setOrderBusy(order.id);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch(`/api/admin/orders/${order.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ note })
    });
    const body = await res.json();
    setOrderBusy(null);
    if (!res.ok) { setNotice({ type: "error", text: body.error || `Could not ${action} order.` }); return; }
    setNotice({ type: "success", text: action === "approve" ? "Payment approved. Plugin ownership and license were granted." : "Order rejected." });
    await loadOrders();
  }

  return (
    <div className="pageWrap adminWrap">
      <p className="eyebrow">ADMINISTRATION</p>
      <h1>Admin Dashboard</h1>
      <p className="muted">Create and manage marketplace listings using your secured admin role.</p>

      {notice && (
        <div className={`notice ${notice.type}`} role="status">
          {notice.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : notice.type === "error" ? (
            <XCircle size={18} />
          ) : (
            <Loader2 size={18} className={checking || saving ? "spin" : ""} />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {!allowed ? (
        <div className="emptyCard">
          <ShieldCheck size={24} />
          <span>{checking ? "Checking admin access…" : "Admin access is required."}</span>
        </div>
      ) : (
        <>
          <div className="formCard">
            <div className="sectionHeading">
              <div>
                <h3>{editingPlugin ? `Edit ${editingPlugin.name}` : "Add Plugin"}</h3>
                <p className="muted smallMuted">
                  {editingPlugin
                    ? "Update the listing, then save your changes."
                    : "Create a new marketplace listing. Slugs must be unique."}
                </p>
              </div>
              {editingPlugin && (
                <button className="secondaryBtn" type="button" onClick={resetForm}>
                  Cancel edit
                </button>
              )}
            </div>

            <form onSubmit={submitPlugin} className="pluginEditorForm">
              <div className="editorTwoCol">
                <label>Plugin Name<input required value={name} onChange={(e)=>setName(e.target.value)} placeholder="ALicense" /></label>
                <label>Plugin Version<input required value={version} onChange={(e)=>setVersion(e.target.value)} placeholder="1.1.1" /></label>
              </div>
              <div className="editorTwoCol">
                <label>Slug<input value={slug} onChange={(e)=>setSlug(e.target.value)} placeholder={name?makeSlug(name):"alicense"}/></label>
                <label>Price (PHP)<input type="number" min="0" step="0.01" value={price} onChange={(e)=>setPrice(e.target.value)}/></label>
              </div>
              <label>{editingPlugin ? "New Release JAR" : "Upload JAR File"} <span className="fieldHint">{editingPlugin?.file_name ? `Current latest: ${editingPlugin.file_name}` : "Required before publishing"}</span>
                <input type="file" accept=".jar,application/java-archive" onChange={(e)=>setJarFile(e.target.files?.[0]??null)} />
              </label>
              <div className="editorTwoCol releaseEditorFields">
                <label>Release Type<select value={releaseType} onChange={(e)=>setReleaseType(e.target.value as any)}><option value="stable">Stable</option><option value="hotfix">Hotfix</option><option value="beta">Beta</option><option value="legacy">Legacy</option></select></label>
                <label>Release Notes / Changelog<textarea value={releaseNotes} onChange={(e)=>setReleaseNotes(e.target.value)} placeholder={editingPlugin ? "Example: Fixed license validation timeout and improved duplicate protection." : "Initial release notes (optional)."}/></label>
              </div>
              {editingPlugin && <p className="releaseEditorHint">Uploading a JAR creates a new permanent version-history entry. Use a new version number (for example, {editingPlugin.version || "1.0.0"} → 1.1.2). Old JARs stay available to existing owners.</p>}
              <label>Full Plugin Description <span className="fieldHint">Emojis, bold, italic, underline, fonts, sizes, colors, and lists supported.</span></label>
              <RichTextEditor value={descriptionHtml} onChange={setDescriptionHtml} />

              <div className="galleryEditorBlock">
                <div><strong>Carousel Pictures</strong><p>Exactly 3 display slots · each image max 5 MB · minimum 500×500 pixels.</p></div>
                <div className="galleryUploadGrid">{[0,1,2].map((i)=><label className="galleryUploadSlot" key={i}><span>Picture {i+1}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e)=>{const next=[...galleryFiles];next[i]=e.target.files?.[0]??null;setGalleryFiles(next)}}/><small>{galleryFiles[i]?.name || editingPlugin?.gallery_images?.[i]?.split('/').pop() || "Choose image"}</small></label>)}</div>
              </div>

              <div className="linkEditorBlock"><strong>Plugin Links</strong><p>Add up to 3 official links shown on the plugin information page.</p>
                <div className="threeCol">
                  <label>Wiki URL<input type="url" value={wikiUrl} onChange={(e)=>setWikiUrl(e.target.value)} placeholder="https://..."/></label>
                  <label>YouTube Tutorial<input type="url" value={youtubeUrl} onChange={(e)=>setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/..."/></label>
                  <label>Discord Link<input type="url" value={discordUrl} onChange={(e)=>setDiscordUrl(e.target.value)} placeholder="https://discord.gg/..."/></label>
                </div>
              </div>
              <label>Status<select value={status} onChange={(e)=>setStatus(e.target.value as "draft"|"published")}><option value="published">Published</option><option value="draft">Draft</option></select></label>
              <button className="primaryBtn editorSaveBtn" type="submit" disabled={saving}>{saving?<Loader2 size={16} className="spin"/>:editingPlugin?<Edit3 size={16}/>:<Plus size={16}/>} {saving?"Saving & Uploading…":editingPlugin?"Save Plugin":"Create Plugin"}</button>
            </form>
          </div>

          <section className="adminListSection">
            <div className="sectionHeading">
              <div>
                <p className="eyebrow">MARKETPLACE LISTINGS</p>
                <h2>Manage Plugins</h2>
                <p className="muted smallMuted">
                  {plugins.length} plugin{plugins.length === 1 ? "" : "s"} currently visible to this admin account.
                </p>
              </div>
              <button className="secondaryBtn" type="button" onClick={loadPlugins} disabled={loadingPlugins}>
                <RefreshCw size={16} className={loadingPlugins ? "spin" : ""} />
                Refresh
              </button>
            </div>

            {loadingPlugins && plugins.length === 0 ? (
              <div className="emptyCard"><Loader2 size={22} className="spin" /><span>Loading plugins…</span></div>
            ) : plugins.length === 0 ? (
              <div className="emptyCard"><ShieldCheck size={22} /><span>No plugin listings found.</span></div>
            ) : (
              <div className="adminPluginList">
                {plugins.map((plugin) => (
                  <article className="adminPluginRow" key={plugin.id}>
                    <div className="adminPluginMain">
                      <div className="adminPluginTitleRow">
                        <h3>{plugin.name}</h3>
                        <span className={`statusBadge ${plugin.status === "published" ? "published" : "draft"}`}>
                          {plugin.status === "published" ? <Eye size={13} /> : <EyeOff size={13} />}
                          {plugin.status}
                        </span>
                      </div>
                      <p>{plugin.description || "No description."}</p>
                      <div className="pluginMeta">
                        <span>/{plugin.slug}</span>
                        <span>v{plugin.version || "—"}</span>
                        <span>{Number(plugin.price || 0) === 0 ? "Free" : `₱${Number(plugin.price).toFixed(2)}`}</span>
                        <span>{plugin.file_name ? `File: ${plugin.file_name}` : "No JAR uploaded"}</span>
                      </div>
                    </div>
                    <div className="adminPluginActions">
                      <button className="secondaryBtn" type="button" onClick={() => prepareNewRelease(plugin)}>
                        <UploadCloud size={15} /> {plugin.file_name ? "New Release" : "Upload JAR"}
                      </button>
                      <button className="secondaryBtn" type="button" onClick={() => beginEdit(plugin)}>
                        <Edit3 size={15} /> Edit
                      </button>
                      <button className="secondaryBtn" type="button" onClick={() => toggleStatus(plugin)}>
                        {plugin.status === "published" ? <EyeOff size={15} /> : <Eye size={15} />}
                        {plugin.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                      <button className="dangerBtn" type="button" onClick={() => deletePlugin(plugin)}>
                        <Trash2 size={15} /> Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="adminListSection paymentOrdersSection">
            <div className="sectionHeading">
              <div>
                <h2>GCash Payment Verification</h2>
                <p className="muted smallMuted">Verify the customer's receipt in Discord first. Approving here grants plugin ownership and creates the license automatically.</p>
              </div>
              <button className="secondaryBtn" type="button" onClick={loadOrders} disabled={loadingOrders}>
                <RefreshCw size={14} className={loadingOrders ? "spin" : ""}/> Refresh Orders
              </button>
            </div>
            {orders.length === 0 ? (
              <div className="emptyCard">No GCash payment orders yet.</div>
            ) : (
              <div className="paymentOrderList">
                {orders.map((order) => (
                  <div className={`paymentOrderRow ${order.status}`} key={order.id}>
                    <div className="paymentOrderMain">
                      <div className="adminPluginTitleRow">
                        <h3>{order.plugins?.name || "Plugin"}</h3>
                        <span className={`orderStatus ${order.status}`}>{order.status}</span>
                      </div>
                      <code>{order.order_code}</code>
                      <p>{order.customer_email}</p>
                      <div className="pluginMeta">
                        <span>GCash</span><span>₱{Number(order.amount).toLocaleString()}</span><span>{new Date(order.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="adminPluginActions">
                      {order.status === "pending" ? (<>
                        <button className="secondaryBtn" disabled={orderBusy === order.id} onClick={() => reviewOrder(order, "reject")}>Reject</button>
                        <button className="primaryBtn" disabled={orderBusy === order.id} onClick={() => reviewOrder(order, "approve")}>
                          <CheckCircle2 size={14}/> {orderBusy === order.id ? "Working…" : "Approve & Grant"}
                        </button>
                      </>) : <span className="muted smallMuted">Reviewed</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {allowed && <AdminVerificationPanel />}
    </div>
  );
}
