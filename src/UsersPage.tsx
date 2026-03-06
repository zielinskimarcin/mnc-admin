import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type Role = "admin" | "staff" | "user";

type Row = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  role: Role;
  short_code: string | null;
  points: number;
};

const FN_URL =
  "https://wqkzxoxprbbbphtlnxzg.supabase.co/functions/v1/admin_users";

async function callFn<T>(
  action: string,
  method: "GET" | "POST",
  body?: any,
  q?: string
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) throw new Error("Brak sesji");

  const url = new URL(FN_URL);
  url.searchParams.set("action", action);
  if (q) url.searchParams.set("q", q);

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }

  return json as T;
}

export default function UsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setMsg(null);
    setLoading(true);

    try {
      const out = await callFn<{ users: Row[] }>(
        "list",
        "GET",
        undefined,
        q.trim() || undefined
      );
      setRows(out.users);
    } catch (e: any) {
      setMsg(e?.message ?? "Błąd");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => rows, [rows]);

  async function setRole(userId: string, role: Role) {
    setMsg(null);
    try {
      await callFn("set_role", "POST", { user_id: userId, role });
      setRows((prev) =>
        prev.map((r) => (r.id === userId ? { ...r, role } : r))
      );
      setMsg("Rola zaktualizowana.");
    } catch (e: any) {
      setMsg(e?.message ?? "Błąd");
    }
  }

  async function resetPassword(email: string | null) {
    if (!email) return;
    setMsg(null);
    try {
      await callFn("reset_password", "POST", { email });
      setMsg("Wysłano mail resetujący hasło.");
    } catch (e: any) {
      setMsg(e?.message ?? "Błąd");
    }
  }

  async function deleteUser(userId: string, email: string | null) {
    const ok = confirm(`Usunąć użytkownika?\n${email ?? userId}`);
    if (!ok) return;

    setMsg(null);

    try {
      await callFn("delete_user", "POST", { user_id: userId });
      setRows((prev) => prev.filter((r) => r.id !== userId));
      setMsg("Użytkownik usunięty.");
    } catch (e: any) {
      setMsg(e?.message ?? "Błąd");
    }
  }

  return (
    <div style={s.page}>
      <h1 style={s.h1}>USERS</h1>

      <div style={s.card}>
        <label style={s.label}>
          SZUKAJ (email / short_code / id)
        </label>

        <input
          style={s.input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="np. gmail / 123 / uuid"
        />

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button style={s.btnWhite} onClick={load} disabled={loading}>
            {loading ? "..." : "ODŚWIEŻ"}
          </button>
        </div>

        {msg && <div style={s.msg}>{msg}</div>}
      </div>

      <div style={{ marginTop: 18, border: "1px solid #000" }}>
        <div style={s.headerRow}>
          <div style={{ ...s.cell, width: 260 }}>EMAIL</div>
          <div style={{ ...s.cell, width: 110 }}>KOD</div>
          <div style={{ ...s.cell, width: 90 }}>PUNKTY</div>
          <div style={{ ...s.cell, width: 110 }}>ROLE</div>
          <div style={{ ...s.cell, flex: 1 }}>AKCJE</div>
        </div>

        {filtered.map((r) => (
          <div key={r.id} style={s.row}>
            <div style={{ ...s.cell, width: 260, fontSize: 12 }}>
              <div>{r.email ?? "-"}</div>
              <div style={{ color: "#6B7280", marginTop: 4 }}>
                {r.id}
              </div>
            </div>

            <div style={{ ...s.cell, width: 110 }}>
              {r.short_code ?? "-"}
            </div>

            <div style={{ ...s.cell, width: 90 }}>
              {r.points ?? 0}
            </div>

            <div style={{ ...s.cell, width: 110 }}>
              <select
                value={r.role}
                onChange={(e) =>
                  setRole(r.id, e.target.value as Role)
                }
                style={s.select}
              >
                <option value="user">user</option>
                <option value="staff">staff</option>
                <option value="admin">admin</option>
              </select>
            </div>

            <div style={{ ...s.cell, flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  style={s.btnWhiteSmall}
                  onClick={() => resetPassword(r.email)}
                >
                  RESET HASŁA
                </button>

                <button
                  style={s.btnDanger}
                  onClick={() => deleteUser(r.id, r.email)}
                >
                  USUŃ
                </button>
              </div>
            </div>
          </div>
        ))}

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
  page: { maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "system-ui" },
  h1: { letterSpacing: 4, fontWeight: 500, textAlign: "center" },
  card: { border: "1px solid #000", padding: 18, marginTop: 18 },

  label: { display: "block", letterSpacing: 2, fontSize: 12, marginBottom: 10 },
  input: {
    width: "100%",
    padding: 14,
    border: "1px solid #000",
    fontSize: 14,
    letterSpacing: 2,
  },

  msg: { marginTop: 14, fontSize: 14, textAlign: "center" },

  headerRow: { display: "flex", borderBottom: "1px solid #000" },
  row: { display: "flex", borderBottom: "1px solid #E5E7EB" },

  cell: {
    padding: 12,
    borderRight: "1px solid #E5E7EB",
    display: "flex",
    alignItems: "center",
  },

  btnWhite: {
    height: 44,
    padding: "0 18px",
    background: "#fff",
    border: "1px solid #000",
    letterSpacing: 2,
    cursor: "pointer",
  },

  btnWhiteSmall: {
    height: 40,
    padding: "0 14px",
    background: "#fff",
    border: "1px solid #000",
    letterSpacing: 2,
    cursor: "pointer",
  },

  btnDanger: {
    height: 40,
    padding: "0 14px",
    background: "#fff",
    border: "1px solid #DC2626",
    color: "#DC2626",
    letterSpacing: 2,
    cursor: "pointer",
  },

  select: {
    width: "100%",
    height: 40,
    border: "1px solid #000",
    letterSpacing: 2,
    padding: "0 8px",
  },
};