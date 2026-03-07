import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

import MenuPage from "./MenuPage";
import PointsPage from "./PointsPage";
import PushPage from "./PushPage";
import UsersPage from "./UsersPage";

type Tab = "menu" | "points" | "push" | "users";
type Role = "admin" | "staff" | "user" | null;

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (error) setMsg(error.message);
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>MNC ADMIN</h1>
      <div style={styles.card}>
        <label style={styles.label}>EMAIL</label>
        <input
          style={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label style={{ ...styles.label, marginTop: 12 }}>HASŁO</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button style={styles.btnBlack} onClick={signIn} disabled={loading}>
          {loading ? "..." : "ZALOGUJ"}
        </button>

        {msg && <div style={styles.msg}>{msg}</div>}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<Role>(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<Tab>("menu");

  // 🔐 Trzymanie sesji
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setBooting(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  // 🔑 Pobranie roli z profiles
  useEffect(() => {
    if (!session?.user?.id) {
      setRole(null);
      return;
    }

    let cancelled = false;

    async function loadRole() {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (!cancelled) {
        if (error || !data) {
          setRole(null);
        } else {
          setRole(data.role);
        }
      }
    }

    loadRole();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const canUseDashboard = useMemo(
    () => role === "admin" || role === "staff",
    [role]
  );

  async function signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  // 🔄 Loader startowy
  if (booting) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, textAlign: "center" }}>
          Ładowanie...
        </div>
      </div>
    );
  }

  // ❌ brak sesji
  if (!session) {
    return <Login />;
  }

  // 🔄 rola jeszcze nie wczytana
  if (role === null) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, textAlign: "center" }}>
          Ładowanie...
        </div>
      </div>
    );
  }

  // ❌ brak dostępu
  if (!canUseDashboard) {
    return (
      <div style={styles.page}>
        <h1 style={styles.h1}>MNC ADMIN</h1>
        <div style={styles.card}>
          <div style={{ textAlign: "center", letterSpacing: 2 }}>
            BRAK DOSTĘPU
          </div>
          <button
            style={{ ...styles.btnWhite, marginTop: 16 }}
            onClick={signOut}
          >
            WYLOGUJ
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "menu", label: "MENU", show: true },
    { key: "points", label: "PUNKTY", show: true },
    { key: "push", label: "PUSH", show: true },
    { key: "users", label: "USERS", show: role === "admin" },
  ];

  return (
    <div>
      <div style={styles.topBar}>
        <div style={styles.brandRow}>
          <div style={styles.brand}>MNC ADMIN</div>
          <div style={styles.badge}>{role?.toUpperCase()}</div>
        </div>

        <button style={styles.smallBtn} onClick={signOut}>
          WYLOGUJ
        </button>
      </div>

      <div style={styles.tabsRow}>
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.key}
              style={tab === t.key ? styles.tabOn : styles.tabOff}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === "menu" && <MenuPage />}
      {tab === "points" && <PointsPage />}
      {tab === "push" && <PushPage />}
      {tab === "users" && <UsersPage />}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 520, margin: "0 auto", padding: 24, fontFamily: "system-ui" },
  h1: { letterSpacing: 4, fontWeight: 500, textAlign: "center" },
  card: { border: "1px solid #000", padding: 18, marginTop: 18, background: "#fff" },
  label: { display: "block", letterSpacing: 2, fontSize: 12, marginBottom: 10 },
  input: { width: "100%", padding: 14, border: "1px solid #000", fontSize: 16, letterSpacing: 2 },
  btnBlack: { width: "100%", height: 48, background: "#000", color: "#fff", border: "1px solid #000", letterSpacing: 2, marginTop: 14 },
  btnWhite: { width: "100%", height: 48, background: "#fff", color: "#000", border: "1px solid #000", letterSpacing: 2 },
  msg: { marginTop: 14, fontSize: 14, color: "#111", textAlign: "center" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid #000" },
  brandRow: { display: "flex", gap: 10, alignItems: "center" },
  brand: { letterSpacing: 3, fontWeight: 500 },
  badge: { border: "1px solid #000", padding: "4px 8px", letterSpacing: 2, fontSize: 12 },
  smallBtn: { border: "1px solid #000", background: "#fff", padding: "10px 12px", letterSpacing: 2 },
  tabsRow: { display: "grid", gridAutoFlow: "column", gridAutoColumns: "1fr", borderBottom: "1px solid #000" },
  tabOn: { height: 54, background: "#000", color: "#fff", border: "none", letterSpacing: 2 },
  tabOff: { height: 54, background: "#fff", color: "#000", border: "none", letterSpacing: 2 },
};