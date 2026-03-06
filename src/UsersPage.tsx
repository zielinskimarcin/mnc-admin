import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type Role = "admin" | "staff" | "user";

type Row = {
  id: string;
  email: string | null;
  short_code: string | null;
  points: number | null;
  role: Role | null;
};

export default function UsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, short_code, points, role")
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
      [r.email, r.short_code, r.role]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(t))
    );
  }, [rows, q]);

  async function setRole(userId: string, role: Role) {
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.rpc("admin_set_role", {
      p_user_id: userId,
      p_role: role,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setRows((prev) =>
      prev.map((r) => (r.id === userId ? { ...r, role } : r))
    );
  }

  async function deleteUser(userId: string, role: Role) {
    if (role === "admin") {
      setMsg("Nie można usunąć administratora.");
      return;
    }

    const ok = confirm("Na pewno usunąć to konto?");
    if (!ok) return;

    setLoading(true);
    setMsg(null);

    const { error } = await supabase.rpc("admin_delete_user", {
      p_user_id: userId,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setRows((prev) => prev.filter((r) => r.id !== userId));
  }

  return (
    <div style={s.page}>
      <h1 style={s.h1}>USERS</h1>

      <div style={s.card}>
        <label style={s.label}>
          SZUKAJ (email / short_code / rola)
        </label>

        <input
          style={s.input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="np. gmail"
        />

        <div style={{ marginTop: 12 }}>
          <button style={s.btnWhite} onClick={load} disabled={loading}>
            {loading ? "..." : "ODŚWIEŻ"}
          </button>
        </div>

        {msg && <div style={s.msg}>{msg}</div>}
      </div>

      <div style={s.table}>
        <div style={s.header}>
          <div style={{ width: 260 }}>EMAIL</div>
          <div style={{ width: 110 }}>KOD</div>
          <div style={{ width: 90 }}>PUNKTY</div>
          <div style={{ width: 90 }}>ROLA</div>
          <div style={{ flex: 1 }}>AKCJE</div>
        </div>

        {filtered.map((r) => {
          const role: Role = (r.role ?? "user") as Role;

          return (
            <div key={r.id} style={s.row}>
              <div style={{ width: 260 }}>{r.email ?? "-"}</div>
              <div style={{ width: 110 }}>{r.short_code ?? "-"}</div>
              <div style={{ width: 90 }}>{r.points ?? 0}</div>
              <div style={{ width: 90 }}>{role}</div>

              <div style={{ flex: 1, display: "flex", gap: 10 }}>
                {role !== "admin" ? (
                  <>
                    {role !== "staff" && (
                      <button
                        style={s.btnBlackSmall}
                        onClick={() => setRole(r.id, "staff")}
                        disabled={loading}
                      >
                        NADAJ STAFF
                      </button>
                    )}

                    {role === "staff" && (
                      <button
                        style={s.btnWhiteSmall}
                        onClick={() => setRole(r.id, "user")}
                        disabled={loading}
                      >
                        COFNIJ DO USER
                      </button>
                    )}

                    <button
                      style={s.btnDangerSmall}
                      onClick={() => deleteUser(r.id, role)}
                      disabled={loading}
                    >
                      USUŃ
                    </button>
                  </>
                ) : (
                  <span style={{ color: "#6B7280" }}>ADMIN</span>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: 16, textAlign: "center" }}>
            Brak wyników
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "system-ui" },
  h1: { letterSpacing: 4, fontWeight: 500, textAlign: "center" },
  card: { border: "1px solid #000", padding: 18, marginTop: 18 },

  label: { display: "block", letterSpacing: 2, fontSize: 12, marginBottom: 10 },
  input: {
    width: "100%",
    padding: 14,
    border: "1px solid #000",
    fontSize: 16,
    letterSpacing: 2,
  },

  msg: { marginTop: 14 },

  table: { marginTop: 20, border: "1px solid #000" },
  header: {
    display: "flex",
    borderBottom: "1px solid #000",
    padding: 12,
    fontWeight: 500,
  },
  row: {
    display: "flex",
    padding: 12,
    borderBottom: "1px solid #E5E7EB",
    alignItems: "center",
  },

  btnWhite: {
    height: 40,
    padding: "0 14px",
    background: "#fff",
    border: "1px solid #000",
    cursor: "pointer",
  },

  btnBlackSmall: {
    height: 36,
    padding: "0 12px",
    background: "#000",
    color: "#fff",
    border: "1px solid #000",
    cursor: "pointer",
  },

  btnWhiteSmall: {
    height: 36,
    padding: "0 12px",
    background: "#fff",
    border: "1px solid #000",
    cursor: "pointer",
  },

  btnDangerSmall: {
    height: 36,
    padding: "0 12px",
    background: "#fff",
    color: "#DC2626",
    border: "1px solid #DC2626",
    cursor: "pointer",
  },
};