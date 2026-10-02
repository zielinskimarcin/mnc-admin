import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, missingSupabaseEnvVars, supabase } from "../supabase";
import DashboardChrome from "../DashboardChrome";
import MenuPage from "../MenuPage";
import PointsPage from "../PointsPage";
import PreviewCustomersPage from "./PreviewCustomersPage";
import PreviewLogin from "./PreviewLogin";
import PreviewMessagesPage from "./PreviewMessagesPage";
import { dashboardTheme } from "./theme";
import type { PreviewBusiness, PreviewMenuItem } from "./types";
import "./preview.css";

type Tab = "menu" | "points" | "push" | "customers" | "business";

const emptyManifest = {
  slug: "",
  display_name: "",
  tagline: "",
  logo_url: null,
  hero_image_url: null,
  font_preset: "modern",
  design_preset: "mnc",
  colors: {
    background: "#F8F7F3",
    surface: "#FFFFFF",
    text: "#20251F",
    muted: "#6D746D",
    accent: "#295C44",
    accentText: "#FFFFFF",
  },
  categories: [{ key: "drinks", label: "Drinks" }],
  reward_title: "A treat on us",
  reward_threshold: 10,
  source_url: null,
  status: "draft",
  menu: [],
};

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function BusinessPicker({ businesses, selected, onSelect }: {
  businesses: PreviewBusiness[];
  selected: PreviewBusiness | null;
  onSelect: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className="dashboard-business-picker" ref={pickerRef}>
    <button className="dashboard-brand dashboard-brand-button" type="button" aria-label="Choose business" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      {selected ? `${selected.display_name.toUpperCase()} ADMIN` : "RESTAURANT ADMIN"}
    </button>
    {open && <div className="dashboard-business-menu" role="menu" aria-label="Businesses">
      {businesses.map((business) => <button key={business.slug} className={`dashboard-business-option${selected?.slug === business.slug ? " is-selected" : ""}`} type="button" role="menuitem" aria-current={selected?.slug === business.slug ? "true" : undefined} onClick={() => { if (selected?.slug !== business.slug) onSelect(business.slug); setOpen(false); }}>
        {business.display_name}
      </button>)}
    </div>}
  </div>;
}

let sessionBootstrap: Promise<Session | null> | null = null;

function connectPreviewOperator(): Promise<Session | null> {
  sessionBootstrap ??= (async () => {
    const { data: current, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (current.session) return current.session;
    if (!import.meta.env.DEV) return null;
    const response = await fetch("/__preview/auto-session", { method: "POST", headers: { "x-app-preview-local": "1" } });
    if (!response.ok) throw new Error("Could not open the local dashboard. Check the Supabase CLI session and refresh the page.");
    const credentials = await response.json() as { token_hash: string };
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: credentials.token_hash, type: "magiclink" });
    if (error || !data.session) throw error ?? new Error("Could not create an operator session.");
    return data.session;
  })();
  return sessionBootstrap;
}

function validateManifest(raw: unknown): asserts raw is typeof emptyManifest {
  if (!raw || typeof raw !== "object") throw new Error("Manifest must be a JSON object");
  const value = raw as Record<string, any>;
  if (typeof value.slug !== "string" || !/^[a-z0-9][a-z0-9-]{1,48}$/.test(value.slug)) throw new Error("Use a lowercase slug, e.g. north-coffee");
  if (typeof value.display_name !== "string" || !value.display_name.trim()) throw new Error("Business name is required");
  if (!["modern", "editorial", "rounded"].includes(value.font_preset)) throw new Error("Choose a supported font preset");
  if (!["mnc", "normal", "chatchat"].includes(value.design_preset)) throw new Error("Choose a supported design preset");
  if (!Array.isArray(value.categories) || !value.categories.length || value.categories.length > 10) throw new Error("Add 1–10 menu categories");
  const keys = value.categories.map((item: any) => item?.key);
  if (keys.some((key: unknown) => typeof key !== "string" || !key)) throw new Error("Each category needs a key");
  if (!Array.isArray(value.menu) || value.menu.length > 200) throw new Error("Menu must contain at most 200 items");
  for (const item of value.menu) {
    if (!keys.includes(item?.category_key) || typeof item?.title !== "string" || !item.title.trim() || !Number.isInteger(item?.price_cents)) {
      throw new Error("Each menu item needs a valid category, title, and integer price_cents");
    }
  }
  if (value.colors && (typeof value.colors !== "object" || Object.values(value.colors).some((color) => typeof color !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(color as string)))) {
    throw new Error("Colors must be six-digit hex values");
  }
  for (const field of ["logo_url", "hero_image_url", "source_url"] as const) {
    const url = value[field];
    if (url && (typeof url !== "string" || !url.startsWith("https://"))) throw new Error(`${field} must be an HTTPS URL`);
  }
}

function SetupPage({ selected, manifestText, setManifestText, busy, editingNew, loaded, onNew, onSave, onUpload }: {
  selected: PreviewBusiness | null;
  manifestText: string;
  setManifestText: (value: string) => void;
  busy: boolean;
  editingNew: boolean;
  loaded: boolean;
  onNew: () => void;
  onSave: () => void;
  onUpload: (kind: "logo_url" | "hero_image_url", file: File | null) => void;
}) {
  return <main className="dashboard-page setup-page">
    <div className="dashboard-page-head"><div><div className="dashboard-page-kicker">OPERATOR TOOLS</div><h1 className="dashboard-page-title">Business setup</h1><p className="dashboard-page-copy">Import a verified brand and menu pack. These tools are separate from the restaurant owner workflow.</p></div><button className="dashboard-button" onClick={onNew}>NEW BUSINESS</button></div>
    <section className="dashboard-panel">
      <div className="setup-upload-grid">
        <label className="setup-file">LOAD JSON<input type="file" accept="application/json,.json" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setManifestText(await file.text()); }} /></label>
        <label className="setup-file">UPLOAD LOGO<input type="file" accept="image/png,image/jpeg" onChange={(event) => onUpload("logo_url", event.target.files?.[0] ?? null)} /></label>
        <label className="setup-file">UPLOAD HERO<input type="file" accept="image/png,image/jpeg" onChange={(event) => onUpload("hero_image_url", event.target.files?.[0] ?? null)} /></label>
      </div>
      <label className="dashboard-field setup-json-field"><span className="dashboard-label">Business manifest</span><textarea className="dashboard-textarea setup-json" spellCheck={false} value={manifestText} onChange={(event) => setManifestText(event.target.value)} /></label>
      <div className="setup-save-row"><span className="dashboard-panel-meta">Check sources, menu names, and prices before changing status to ready.</span><button className="dashboard-button" disabled={busy || (!editingNew && !!selected && !loaded)} onClick={onSave}>{busy ? "SAVING…" : "SAVE BUSINESS PACK"}</button></div>
    </section>
  </main>;
}

export default function PreviewOperatorApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [operator, setOperator] = useState(false);
  const [operatorLoading, setOperatorLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [businesses, setBusinesses] = useState<PreviewBusiness[]>([]);
  const [businessesReady, setBusinessesReady] = useState(false);
  const [slug, setSlug] = useState("");
  const [menu, setMenu] = useState<PreviewMenuItem[]>([]);
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("menu");
  const [visitedTabs, setVisitedTabs] = useState<Tab[]>(["menu"]);
  const [manifestText, setManifestText] = useState(JSON.stringify(emptyManifest, null, 2));
  const [editingNew, setEditingNew] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const requestRef = useRef(0);
  const selected = useMemo(() => businesses.find((business) => business.slug === slug) ?? null, [businesses, slug]);

  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    void connectPreviewOperator().then((next) => { if (active) setSession(next); }).catch((error) => { if (active) setAccessError(message(error)); }).finally(() => { if (active) setBooting(false); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session?.user.id) {
      setOperator(false);
      setOperatorLoading(false);
      return;
    }
    let active = true;
    setOperatorLoading(true);
    supabase.from("preview_operators").select("user_id").eq("user_id", session.user.id).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      setOperator(Boolean(data) && !error);
      setOperatorLoading(false);
      if (error) setNotice(error.message);
    });
    return () => { active = false; };
  }, [session?.user.id]);

  const loadBusinesses = useCallback(async () => {
    const { data, error } = await supabase.from("preview_businesses").select("*").order("display_name");
    if (error) throw error;
    const rows = (data ?? []) as PreviewBusiness[];
    setBusinesses(rows);
    setSlug((current) => rows.some((business) => business.slug === current) ? current : rows.find((business) => business.slug === "mnc")?.slug ?? rows[0]?.slug ?? "");
  }, []);

  const loadMenu = useCallback(async (businessSlug: string) => {
    if (!businessSlug) return;
    const request = ++requestRef.current;
    const { data, error } = await supabase.from("preview_menu_items").select("*").eq("business_slug", businessSlug).order("position");
    if (request !== requestRef.current) return;
    if (error) throw error;
    setMenu((data ?? []) as PreviewMenuItem[]);
    setLoadedSlug(businessSlug);
  }, []);

  useEffect(() => {
    if (!operator) return;
    loadBusinesses().catch((error) => setNotice(message(error))).finally(() => setBusinessesReady(true));
  }, [operator, loadBusinesses]);
  useEffect(() => { if (operator && slug) loadMenu(slug).catch((error) => setNotice(message(error))); }, [operator, slug, loadMenu]);

  useEffect(() => {
    if (!selected || editingNew || loadedSlug !== selected.slug) return;
    const { slug: businessSlug, display_name, tagline, logo_url, hero_image_url, font_preset, design_preset, colors, categories, reward_title, reward_threshold, source_url, status } = selected;
    setManifestText(JSON.stringify({
      slug: businessSlug, display_name, tagline, logo_url, hero_image_url,
      font_preset, design_preset, colors, categories, reward_title, reward_threshold, source_url, status,
      menu: menu.map(({ category_key, section, title, description, price_cents }) => ({ category_key, section, title, description, price_cents })),
    }, null, 2));
  }, [selected, menu, editingNew, loadedSlug]);

  async function importManifest() {
    setBusy(true);
    setNotice("");
    try {
      const parsed: unknown = JSON.parse(manifestText);
      validateManifest(parsed);
      const { data, error } = await supabase.rpc("preview_import_business", { p_manifest: parsed });
      if (error) throw error;
      setEditingNew(false);
      await loadBusinesses();
      setSlug(String(data));
      await loadMenu(String(data));
      setNotice(`Saved ${String(data)}. Refresh the mobile app to load the latest pack.`);
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function uploadAsset(kind: "logo_url" | "hero_image_url", file: File | null) {
    if (!file) return;
    setBusy(true);
    setNotice("");
    try {
      if (!["image/png", "image/jpeg"].includes(file.type)) throw new Error("Choose a PNG or JPEG image");
      if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB");
      const manifest: unknown = JSON.parse(manifestText);
      validateManifest(manifest);
      const extension = file.type === "image/png" ? "png" : "jpg";
      const path = `${manifest.slug}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("preview-assets").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("preview-assets").getPublicUrl(path);
      setManifestText(JSON.stringify({ ...manifest, [kind]: data.publicUrl }, null, 2));
      setNotice("Image uploaded. Save the business pack to publish it to the app.");
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
  }

  if (!isSupabaseConfigured) return <div className="preview-login-shell"><section className="preview-login-card"><h1>Missing configuration</h1><p>Set the separate App Preview Supabase project.</p><code>{missingSupabaseEnvVars.join(", ")}</code></section></div>;
  if (booting || (session && operatorLoading)) return <div className="preview-login-shell"><section className="preview-login-card">Loading secure workspace…</section></div>;
  if (!session) return import.meta.env.DEV && accessError
    ? <div className="preview-login-shell"><section className="preview-login-card"><h1>Could not open dashboard</h1><p>{accessError}</p><button className="dashboard-button" onClick={() => window.location.reload()}>RETRY</button></section></div>
    : <PreviewLogin />;
  if (!operator) return <div className="preview-login-shell"><section className="preview-login-card"><h1>Access restricted</h1><p>This account is not an approved preview operator.</p><button className="dashboard-button dashboard-button--ghost" onClick={signOut}>SIGN OUT</button></section></div>;
  if (!businessesReady) return <div className="preview-login-shell"><section className="preview-login-card">Loading restaurants…</section></div>;

  return <div className="preview-shell" style={dashboardTheme(selected)} data-preset={selected?.design_preset ?? "mnc"}>
    <DashboardChrome
      title={selected ? `${selected.display_name.toUpperCase()} ADMIN` : "RESTAURANT ADMIN"}
      brandControl={<BusinessPicker businesses={businesses} selected={selected} onSelect={(nextSlug) => { setLoadedSlug(null); setMenu([]); setSlug(nextSlug); setEditingNew(false); setNotice(""); setTab("menu"); setVisitedTabs(["menu"]); }} />}
      role="operator"
      hideRole
      signOutLabel="SIGN OUT"
      tabs={[
        { key: "menu", label: "MENU" },
        { key: "points", label: "POINTS" },
        { key: "push", label: "PUSH" },
        { key: "customers", label: "USERS" },
      ]}
      activeTab={tab}
      onTab={(next) => { const nextTab = next as Tab; setTab(nextTab); setVisitedTabs((current) => current.includes(nextTab) ? current : [...current, nextTab]); setNotice(""); }}
      onSignOut={signOut}
    >
      {notice && <div className="dashboard-page"><div className="dashboard-notice global-notice">{notice}</div></div>}
      {selected && visitedTabs.includes("menu") && <div className="preview-tab-panel" hidden={tab !== "menu"}><MenuPage key={slug} previewBusiness={selected} previewMenuItems={loadedSlug === slug ? menu : undefined} onChanged={() => loadMenu(slug)} /></div>}
      {selected && visitedTabs.includes("points") && <div className="preview-tab-panel" hidden={tab !== "points"}><PointsPage key={slug} previewBusiness={selected} active={tab === "points"} /></div>}
      {selected && visitedTabs.includes("push") && <div className="preview-tab-panel" hidden={tab !== "push"}><PreviewMessagesPage key={slug} business={selected} active={tab === "push"} /></div>}
      {selected && visitedTabs.includes("customers") && <div className="preview-tab-panel" hidden={tab !== "customers"}><PreviewCustomersPage key={slug} business={selected} active={tab === "customers"} /></div>}
      {tab === "business" && <SetupPage selected={selected} manifestText={manifestText} setManifestText={(value) => { setManifestText(value); setEditingNew(true); }} busy={busy} editingNew={editingNew} loaded={loadedSlug === selected?.slug} onNew={() => { setEditingNew(true); setManifestText(JSON.stringify(emptyManifest, null, 2)); }} onSave={importManifest} onUpload={uploadAsset} />}
      {tab !== "business" && !selected && <main className="dashboard-page"><section className="dashboard-panel dashboard-empty">Add a business pack first.</section></main>}
    </DashboardChrome>
  </div>;
}
