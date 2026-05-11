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

type DashboardStats = {
  users: {
    total: number;
    admins: number;
    staff: number;
    regular: number;
    new30d: number;
    rewardReady: number;
    averagePoints: number;
  };
  loyalty: {
    events: number;
    events30d: number;
    rewardsRedeemed: number;
    rewardsRedeemed30d: number;
    pointsAdded30d: number;
  };
  push: {
    tokens: number;
    campaigns: number;
    campaignTargets: number;
    sent: number;
    opens: number;
    openRate: number;
    jobs: number;
  };
  menu: {
    items: number;
  };
};

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("pl-PL").format(Number(value ?? 0));
}

function StatCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string | number;
  meta: string;
}) {
  return (
    <div style={s.statCard}>
      <div style={s.statLabel}>{label}</div>
      <div style={s.statValue}>{value}</div>
      <div style={s.statMeta}>{meta}</div>
    </div>
  );
}

export default function UsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsMsg, setStatsMsg] = useState<string | null>(null);
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

  async function loadStats() {
    const { data, error } = await supabase.functions.invoke<DashboardStats>(
      "dashboard_stats",
      { body: {} }
    );

    if (error) {
      setStatsMsg(error.message);
      return;
    }

    setStats(data ?? null);
    setStatsMsg(null);
  }

  useEffect(() => {
    load();
    loadStats();
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
          <button
            style={s.btnWhite}
            onClick={async () => {
              await load();
              await loadStats();
            }}
            disabled={loading}
          >
            {loading ? "..." : "ODŚWIEŻ"}
          </button>
        </div>

        {msg && <div style={s.msg}>{msg}</div>}
      </div>

      {stats && (
        <>
          <div style={s.statsGrid}>
            <StatCard
              label="UŻYTKOWNICY"
              value={formatNumber(stats.users.total)}
              meta={`+${formatNumber(stats.users.new30d)} / 30 DNI`}
            />
            <StatCard
              label="GOTOWE NAGRODY"
              value={formatNumber(stats.users.rewardReady)}
              meta={`ŚR. ${stats.users.averagePoints} PKT`}
            />
            <StatCard
              label="PUSH TOKENY"
              value={formatNumber(stats.push.tokens)}
              meta={`${stats.push.openRate}% OPEN RATE`}
            />
            <StatCard
              label="ODEBRANE NAGRODY"
              value={formatNumber(stats.loyalty.rewardsRedeemed)}
              meta={`+${formatNumber(stats.loyalty.rewardsRedeemed30d)} / 30 DNI`}
            />
          </div>

          <div style={s.statsStrip}>
            <span>ADMIN {formatNumber(stats.users.admins)}</span>
            <span>STAFF {formatNumber(stats.users.staff)}</span>
            <span>MENU {formatNumber(stats.menu.items)}</span>
            <span>KAMPANIE {formatNumber(stats.push.campaigns)}</span>
            <span>OPERACJE 30D {formatNumber(stats.loyalty.events30d)}</span>
            <span>PUNKTY +{formatNumber(stats.loyalty.pointsAdded30d)}</span>
          </div>
        </>
      )}

      {statsMsg && <div style={s.statsMsg}>STATYSTYKI: {statsMsg}</div>}

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

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
    marginTop: 20,
  },
  statCard: {
    border: "1px solid #000",
    padding: 16,
    minHeight: 112,
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  statLabel: {
    letterSpacing: 2,
    fontSize: 11,
    color: "#4B5563",
  },
  statValue: {
    fontSize: 34,
    lineHeight: 1,
    letterSpacing: 1,
    fontWeight: 500,
    marginTop: 12,
  },
  statMeta: {
    letterSpacing: 1.5,
    fontSize: 11,
    color: "#111",
    marginTop: 14,
  },
  statsStrip: {
    border: "1px solid #000",
    borderTop: "none",
    padding: "12px 14px",
    display: "flex",
    flexWrap: "wrap",
    gap: "10px 18px",
    letterSpacing: 1.5,
    fontSize: 11,
    color: "#111",
  },
  statsMsg: {
    marginTop: 14,
    border: "1px solid #000",
    padding: 12,
    textAlign: "center",
    fontSize: 12,
    letterSpacing: 1,
  },

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
