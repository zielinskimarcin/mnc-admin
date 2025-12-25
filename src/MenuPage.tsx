import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type MenuItem = {
  id: string;
  category: "MATCHA" | "NAPOJE" | "JEDZENIE";
  section: string;
  title: string;
  description: string | null;
  price: number; // grosze
  order_index: number;
};

const CATS = ["MATCHA", "NAPOJE", "JEDZENIE"] as const;

function groszeToZl(p: number) {
  return (p / 100).toFixed(2).replace(".", ",");
}
function zlToGrosze(v: string) {
  const cleaned = v.trim().replace(",", ".");
  const n = Number(cleaned);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

export default function MenuPage() {
  const [cat, setCat] = useState<(typeof CATS)[number]>("MATCHA");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, MenuItem>>({});
  const [loading, setLoading] = useState(true);

  // DODAWANIE
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    category: "MATCHA" as MenuItem["category"],
    section: "",
    title: "",
    description: "",
    priceZl: "",
  });

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .order("category")
      .order("section")
      .order("order_index");

    setItems((data ?? []) as MenuItem[]);
    setDrafts(Object.fromEntries((data ?? []).map((x: MenuItem) => [x.id, x])));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => items.filter((x) => x.category === cat),
    [items, cat]
  );

  function updateDraft(id: string, patch: Partial<MenuItem>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  async function saveItem(id: string) {
    await supabase.from("menu_items").update(drafts[id]).eq("id", id);
    await load();
  }

  async function deleteItem(id: string) {
    if (!confirm("Usunąć pozycję?")) return;
    await supabase.from("menu_items").delete().eq("id", id);
    await load();
  }

  async function addItem() {
    const price = zlToGrosze(form.priceZl);
    if (price === null || !form.title || !form.section) return;

    // 🔑 AUTOMATYCZNY order_index = ostatni w danej sekcji
    const sameSection = items.filter(
      (x) => x.category === form.category && x.section === form.section
    );
    const maxOrder =
      sameSection.length > 0
        ? Math.max(...sameSection.map((x) => x.order_index))
        : 0;

    await supabase.from("menu_items").insert({
      category: form.category,
      section: form.section,
      title: form.title,
      description: form.description || null,
      price,
      order_index: maxOrder + 1,
    });

    setForm({ category: cat, section: "", title: "", description: "", priceZl: "" });
    setAddOpen(false);
    await load();
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>MENU</h1>

      {/* TABS */}
      <div style={styles.tabs}>
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            style={cat === c ? styles.tabOn : styles.tabOff}
          >
            {c}
          </button>
        ))}
      </div>

      {/* DODAJ */}
      <div style={styles.center}>
        <button
          style={styles.addBtn}
          onClick={() => {
            setAddOpen((v) => !v);
            setForm((f) => ({ ...f, category: cat }));
          }}
        >
          {addOpen ? "ZAMKNIJ" : "DODAJ POZYCJĘ"}
        </button>
      </div>

      {addOpen && (
        <div style={styles.card}>
          <input
            style={styles.input}
            placeholder="Sekcja"
            value={form.section}
            onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
          />
          <input
            style={styles.input}
            placeholder="Tytuł"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <input
            style={styles.input}
            placeholder="Opis"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <input
            style={styles.input}
            placeholder="Cena (zł)"
            value={form.priceZl}
            onChange={(e) => setForm((f) => ({ ...f, priceZl: e.target.value }))}
          />

          <div style={styles.center}>
            <button style={styles.saveBtn} onClick={addItem}>
              ZAPISZ
            </button>
          </div>
        </div>
      )}

      {/* LISTA */}
      {loading ? (
        <p>Ładowanie…</p>
      ) : (
        filtered.map((it) => {
          const d = drafts[it.id];
          return (
            <div key={it.id} style={styles.itemCard}>
              <input
                style={styles.input}
                value={d.section}
                onChange={(e) => updateDraft(it.id, { section: e.target.value })}
              />
              <input
                style={styles.input}
                value={d.title}
                onChange={(e) => updateDraft(it.id, { title: e.target.value })}
              />
              <input
                style={styles.input}
                value={d.description ?? ""}
                onChange={(e) =>
                  updateDraft(it.id, { description: e.target.value })
                }
              />
              <input
                style={styles.input}
                value={groszeToZl(d.price)}
                onChange={(e) => {
                  const p = zlToGrosze(e.target.value);
                  if (p !== null) updateDraft(it.id, { price: p });
                }}
              />

              <div style={styles.btnRow}>
                <button style={styles.saveBtn} onClick={() => saveItem(it.id)}>
                  ZAPISZ
                </button>
                <button
                  style={styles.deleteBtn}
                  onClick={() => deleteItem(it.id)}
                >
                  USUŃ
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 720, margin: "0 auto", padding: 24 },
  h1: { letterSpacing: 4, fontWeight: 500, textAlign: "center" },

  tabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    border: "1px solid #000",
    marginTop: 18,
  },
  tabOn: { height: 48, background: "#000", color: "#fff", border: "none" },
  tabOff: { height: 48, background: "#fff", color: "#000", border: "none" },

  center: { display: "flex", justifyContent: "center", marginTop: 16 },

  addBtn: {
    padding: "14px 40px",
    border: "1px solid #000",
    background: "#fff",
    letterSpacing: 2,
    cursor: "pointer",
  },

  saveBtn: {
    padding: "14px 40px",
    border: "1px solid #000",
    background: "#000",
    color: "#fff",
    letterSpacing: 2,
    cursor: "pointer",
  },

  deleteBtn: {
    padding: "14px 40px",
    border: "1px solid #000",
    background: "#fff",
    letterSpacing: 2,
    cursor: "pointer",
  },

  card: { border: "1px solid #000", padding: 18, marginTop: 18 },
  itemCard: { border: "1px solid #000", padding: 18, marginTop: 18 },

  input: { width: "100%", padding: 12, border: "1px solid #000", marginTop: 8 },

  btnRow: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    marginTop: 16,
  },
};