import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type Row = {
  id: string;
  email: string | null;
  name: string | null;
  short_code: string | null;
  points: number | null;
  role: "admin" | "staff" | "user" | null;
};

export default function UsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setMsg(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, name, short_code, points, role")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.email, r.name, r.short_code, r.role]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(t))
    );
  }, [rows, q]);

  async function setRole(userId: string, role: "staff" | "user") {
    setMsg(null);
    setLoading(true);

    const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === userId ? { ...r, role } : r)));
  }

  return (
    <div style={s.page}>
      <h1 style={s.h1}>USERS</h1>

      <div style={s.card}>
        <label style={s.label}>SZUKAJ (email / name / short_code)</label>
        <input style={s.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="np. 123 albo gmail" />

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button style={s.btnWhite} onClick={load} disabled={loading}>
            {loading ? "..." : "ODŚWIEŻ"}
          </button>
        </div>

        {msg && <div style={s.msg}>{msg}</div>}
      </div>

      <div style={{ marginTop: 18, border: "1px solid #000" }}>
        <div style={s.headerRow}>
          <div style={{ ...s.cell, width: 220 }}>EMAIL</div>
          <div style={{ ...s.cell, width: 110 }}>KOD</div>
          <div style={{ ...s.cell, width: 90 }}>PUNKTY</div>
          <div style={{ ...s.cell, width: 90 }}>ROLE</div>
          <div style={{ ...s.cell, flex: 1 }}>AKCJE</div>
        </div>

        {filtered.map((r) => {
          const role = r.role ?? "user";
          const isAdmin = role === "admin";

          return (
            <div key={r.id} style={s.row}>
              <div style={{ ...s.cell, width: 220, fontSize: 12 }}>{r.email ?? "-"}</div>
              <div style={{ ...s.cell, width: 110 }}>{r.short_code ?? "-"}</div>
              <div style={{ ...s.cell, width: 90 }}>{r.points ?? 0}</div>
              <div style={{ ...s.cell, width: 90, letterSpacing: 2 }}>{role}</div>
              <div style={{ ...s.cell, flex: 1 }}>
                {isAdmin ? (
                  <span style={{ color: "#6B7280" }}>ADMIN</span>
                ) : (
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-start", flexWrap: "wrap" }}>
                    {role !== "staff" && (
                      <button style={s.btnBlack} onClick={() => setRole(r.id, "staff")} disabled={loading}>
                        NADAJ STAFF
                      </button>
                    )}
                    {role === "staff" && (
                      <button style={s.btnWhiteSmall} onClick={() => setRole(r.id, "user")} disabled={loading}>
                        COFNIJ DO USER
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && <div style={{ padding: 16, textAlign: "center" }}>Brak wyników</div>}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "system-ui" },
  h1: { letterSpacing: 4, fontWeight: 500, textAlign: "center" },
  card: { border: "1px solid #000", padding: 18, marginTop: 18, background: "#fff" },

  label: { display: "block", letterSpacing: 2, fontSize: 12, marginBottom: 10 },
  input: {
    width: "100%",
    padding: 14,
    border: "1px solid #000",
    outline: "none",
    fontSize: 16,
    letterSpacing: 2,
  },

  msg: { marginTop: 14, fontSize: 14, color: "#111", textAlign: "center" },

  headerRow: { display: "flex", borderBottom: "1px solid #000", background: "#fff" },
  row: { display: "flex", borderBottom: "1px solid #E5E7EB" },

  cell: { padding: 12, borderRight: "1px solid #E5E7EB", display: "flex", alignItems: "center" },

  btnBlack: {
    height: 40,
    padding: "0 14px",
    background: "#000",
    color: "#fff",
    border: "1px solid #000",
    letterSpacing: 2,
    cursor: "pointer",
  },
  btnWhite: {
    height: 44,
    padding: "0 18px",
    background: "#fff",
    color: "#000",
    border: "1px solid #000",
    letterSpacing: 2,
    cursor: "pointer",
    width: "100%",
  },
  btnWhiteSmall: {
    height: 40,
    padding: "0 14px",
    background: "#fff",
    color: "#000",
    border: "1px solid #000",
    letterSpacing: 2,
    cursor: "pointer",
  },
};