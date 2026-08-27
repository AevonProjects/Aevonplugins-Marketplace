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
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

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
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("1.0.0");
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
    setVersion("1.0.0");
    setPrice("0");
    setStatus("published");
  }, []);

  const loadPlugins = useCallback(async () => {
    if (!supabase) return;
    setLoadingPlugins(true);
    const { data, error } = await supabase
      .from("plugins")
      .select("id,name,slug,description,version,price,status,created_at,updated_at")
      .order("created_at", { ascending: false });

    setLoadingPlugins(false);
    if (error) {
      setNotice({ type: "error", text: `Could not load plugins: ${error.message}` });
      return;
    }
    setPlugins((data ?? []) as PluginRow[]);
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

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .single();

      if (error || data?.role !== "admin") {
        setNotice({ type: "error", text: "This account does not have admin access." });
        setChecking(false);
        return;
      }

      setAllowed(true);
      setChecking(false);
      setNotice(null);
      await loadPlugins();
    })();
  }, [loadPlugins]);

  async function submitPlugin(e: FormEvent) {
    e.preventDefault();
    if (!supabase || saving) return;

    const normalizedSlug = makeSlug(slug || name);
    if (!normalizedSlug) {
      setNotice({ type: "error", text: "Please enter a valid plugin name or slug." });
      return;
    }

    setSaving(true);
    setNotice({
      type: "info",
      text: editingId ? "Saving plugin changes…" : "Creating plugin…",
    });

    const payload = {
      name: name.trim(),
      slug: normalizedSlug,
      description: description.trim(),
      version: version.trim(),
      price: Number(price) || 0,
      status,
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase.from("plugins").update(payload).eq("id", editingId)
      : await supabase.from("plugins").insert(payload);

    setSaving(false);

    if (result.error) {
      const duplicate = result.error.code === "23505";
      setNotice({
        type: "error",
        text: duplicate
          ? `A plugin with the slug “${normalizedSlug}” already exists.`
          : result.error.message,
      });
      return;
    }

    setNotice({
      type: "success",
      text: editingId ? "Plugin updated successfully." : "Plugin created successfully.",
    });
    resetForm();
    await loadPlugins();
  }

  function beginEdit(plugin: PluginRow) {
    setEditingId(plugin.id);
    setName(plugin.name);
    setSlug(plugin.slug);
    setDescription(plugin.description ?? "");
    setVersion(plugin.version ?? "1.0.0");
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

            <form onSubmit={submitPlugin}>
              <label>
                Name
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="ALicense" />
              </label>
              <label>
                Slug
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder={name ? makeSlug(name) : "alicense"}
                />
              </label>
              <label>
                Description
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this plugin do?"
                />
              </label>
              <div className="threeCol">
                <label>
                  Version
                  <input required value={version} onChange={(e) => setVersion(e.target.value)} />
                </label>
                <label>
                  Price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </label>
                <label>
                  Status
                  <select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")}>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </label>
              </div>
              <button className="primaryBtn" type="submit" disabled={saving}>
                {saving ? <Loader2 size={16} className="spin" /> : editingPlugin ? <Edit3 size={16} /> : <Plus size={16} />}
                {saving ? "Saving…" : editingPlugin ? "Save changes" : "Create plugin"}
              </button>
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
                        <span>{Number(plugin.price || 0) === 0 ? "Free" : `$${Number(plugin.price).toFixed(2)}`}</span>
                      </div>
                    </div>
                    <div className="adminPluginActions">
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
        </>
      )}
    </div>
  );
}
