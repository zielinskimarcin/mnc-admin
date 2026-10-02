import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { defaultMenuCategory, tenant } from "./tenant";
import type { PreviewMenuItem } from "./preview/types";

type PreviewBusiness = {
  slug: string;
  categories: { key: string; label: string }[];
};

type MenuItem = {
  id: string;
  category: string;
  section: string;
  title: string;
  description: string | null;
  price: number;
  order_index: number;
};

function amountToInput(value: number, currency: "USD" | "PLN") {
  const formatted = (value / 100).toFixed(2);
  return currency === "PLN" ? formatted.replace(".", ",") : formatted;
}

function inputToAmount(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function fromPreviewItems(rows: PreviewMenuItem[]): MenuItem[] {
  return rows.map((item) => ({
    id: item.id,
    category: item.category_key,
    section: item.section,
    title: item.title,
    description: item.description,
    price: item.price_cents,
    order_index: item.position,
  }));
}

export default function MenuPage({ previewBusiness, previewMenuItems, onChanged }: {
  previewBusiness?: PreviewBusiness;
  previewMenuItems?: PreviewMenuItem[];
  onChanged?: () => Promise<void>;
} = {}) {
  const categories = previewBusiness?.categories.map((item) => item.key) ?? tenant.menuCategories;
  const firstCategory = categories[0] ?? defaultMenuCategory;
  const previewSlug = previewBusiness?.slug;
  const currency: "USD" | "PLN" = previewBusiness && !["mnc", "mozzi"].includes(previewBusiness.slug) ? "USD" : "PLN";
  const [category, setCategory] = useState<string>(firstCategory);
  const [items, setItems] = useState<MenuItem[]>(() => previewMenuItems ? fromPreviewItems(previewMenuItems) : []);
  const [drafts, setDrafts] = useState<Record<string, MenuItem>>(() => Object.fromEntries(items.map((item) => [item.id, item])));
  const [loading, setLoading] = useState(!previewMenuItems);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ section: "", title: "", description: "", price: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (previewSlug) {
        const { data, error } = await supabase.from("preview_menu_items").select("*")
          .eq("business_slug", previewSlug).order("category_key").order("section").order("position");
        if (error) throw error;
        const rows = fromPreviewItems((data ?? []) as PreviewMenuItem[]);
        setItems(rows);
        setDrafts(Object.fromEntries(rows.map((item) => [item.id, item])));
      } else {
        const { data, error } = await supabase.from("menu_items").select("*")
          .order("category").order("section").order("order_index");
        if (error) throw error;
        const rows = (data ?? []) as MenuItem[];
        setItems(rows);
        setDrafts(Object.fromEntries(rows.map((item) => [item.id, item])));
      }
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [previewSlug]);

  useEffect(() => {
    setCategory(firstCategory);
    setAddOpen(false);
    setNotice("");
    if (!previewBusiness) void load();
  }, [previewSlug, firstCategory, load, previewBusiness]);

  useEffect(() => {
    if (!previewMenuItems) return;
    const rows = fromPreviewItems(previewMenuItems);
    setItems(rows);
    setDrafts(Object.fromEntries(rows.map((item) => [item.id, item])));
    setLoading(false);
  }, [previewMenuItems]);

  const filtered = useMemo(
    () => items.filter((item) => item.category === category),
    [items, category]
  );

  function updateDraft(id: string, patch: Partial<MenuItem>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  async function saveItem(id: string) {
    setSavingId(id);
    setNotice("");
    try {
      const item = drafts[id];
      if (previewBusiness) {
        const { error } = await supabase.from("preview_menu_items").update({
          category_key: item.category,
          section: item.section.trim(),
          title: item.title.trim(),
          description: item.description?.trim() || null,
          price_cents: item.price,
          position: item.order_index,
        }).eq("id", id).eq("business_slug", previewBusiness.slug);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_items").update(item).eq("id", id);
        if (error) throw error;
      }
      if (previewBusiness && onChanged) await onChanged();
      else await load();
      setNotice("Menu item saved.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setSavingId(null);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this menu item?")) return;
    setSavingId(id);
    setNotice("");
    try {
      const query = previewBusiness
        ? supabase.from("preview_menu_items").delete().eq("id", id).eq("business_slug", previewBusiness.slug)
        : supabase.from("menu_items").delete().eq("id", id);
      const { error } = await query;
      if (error) throw error;
      if (previewBusiness && onChanged) await onChanged();
      else await load();
      setNotice("Menu item deleted.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setSavingId(null);
    }
  }

  async function addItem() {
    const price = inputToAmount(form.price);
    if (price === null || !form.title.trim() || !form.section.trim()) {
      setNotice("Add a section, item name, and valid price.");
      return;
    }
    setSavingId("new");
    setNotice("");
    try {
      const sameSection = items.filter((item) => item.category === category && item.section === form.section.trim());
      const nextPosition = sameSection.length ? Math.max(...sameSection.map((item) => item.order_index)) + 1 : 1;
      if (previewBusiness) {
        const { error } = await supabase.from("preview_menu_items").insert({
          business_slug: previewBusiness.slug,
          category_key: category,
          section: form.section.trim(),
          title: form.title.trim(),
          description: form.description.trim() || null,
          price_cents: price,
          position: nextPosition,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_items").insert({
          category,
          section: form.section.trim(),
          title: form.title.trim(),
          description: form.description.trim() || null,
          price,
          order_index: nextPosition,
        });
        if (error) throw error;
      }
      setForm({ section: "", title: "", description: "", price: "" });
      setAddOpen(false);
      if (previewBusiness && onChanged) await onChanged();
      else await load();
      setNotice("Menu item added.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setSavingId(null);
    }
  }

  return <main className="dashboard-page menu-editor" data-testid="menu-page">
    <div className="dashboard-page-head">
      <h1 className="dashboard-page-title">Menu</h1>
    </div>

    <div className="dashboard-segments" aria-label="Menu categories">
      {categories.map((key) => <button
        key={key}
        className={`dashboard-segment${category === key ? " is-active" : ""}`}
        onClick={() => setCategory(key)}
      >
        {previewBusiness?.categories.find((item) => item.key === key)?.label ?? key}
      </button>)}
    </div>

    <div className="menu-center">
      <button className="dashboard-button dashboard-button--ghost menu-add-button" onClick={() => setAddOpen((open) => !open)}>
        {addOpen ? "CLOSE" : "ADD ITEM"}
      </button>
    </div>

    {notice && <div className="dashboard-notice menu-notice">{notice}</div>}

    {addOpen && <section className="dashboard-panel menu-add-panel">
      <input className="dashboard-input menu-stack-input" value={form.section} onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))} placeholder="Section" />
      <input className="dashboard-input menu-stack-input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Title" />
      <input className="dashboard-input menu-stack-input" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
      <input className="dashboard-input menu-stack-input" inputMode="decimal" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} placeholder={`Price (${currency})`} />
      <div className="menu-center"><button className="dashboard-button menu-save-button" disabled={savingId === "new"} onClick={addItem}>{savingId === "new" ? "SAVING…" : "SAVE"}</button></div>
    </section>}

    <section className="menu-list" aria-live="polite">
      {loading && <div className="dashboard-panel dashboard-empty">Loading menu…</div>}
      {!loading && filtered.length === 0 && <div className="dashboard-panel dashboard-empty">No items in this category yet.</div>}
      {!loading && filtered.map((item) => {
        const draft = drafts[item.id];
        return <article className="dashboard-panel menu-item-card" key={item.id}>
          <input className="dashboard-input menu-stack-input" aria-label="Section" value={draft.section} onChange={(event) => updateDraft(item.id, { section: event.target.value })} />
          <input className="dashboard-input menu-stack-input" aria-label="Title" value={draft.title} onChange={(event) => updateDraft(item.id, { title: event.target.value })} />
          <input className="dashboard-input menu-stack-input" aria-label="Description" value={draft.description ?? ""} onChange={(event) => updateDraft(item.id, { description: event.target.value })} />
          <input className="dashboard-input menu-stack-input" aria-label={`Price (${currency})`} inputMode="decimal" value={amountToInput(draft.price, currency)} onChange={(event) => { const value = inputToAmount(event.target.value); if (value !== null) updateDraft(item.id, { price: value }); }} />
          <div className="dashboard-actions menu-item-actions">
            <button className="dashboard-button" disabled={savingId === item.id} onClick={() => saveItem(item.id)}>{savingId === item.id ? "SAVING…" : "SAVE"}</button>
            <button className="dashboard-button dashboard-button--ghost" disabled={savingId === item.id} onClick={() => deleteItem(item.id)}>DELETE</button>
          </div>
        </article>;
      })}
    </section>
  </main>;
}
