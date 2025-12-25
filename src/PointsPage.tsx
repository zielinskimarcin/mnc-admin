import { useState } from "react";
import { supabase } from "./supabase";

export default function PointsPage() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function findProfileByCode(short_code: string) {
    return await supabase
      .from("profiles")
      .select("id, points")
      .eq("short_code", short_code)
      .single();
  }

  async function addPoint() {
    setMsg(null);
    const trimmed = code.trim();

    if (!/^\d{3}$/.test(trimmed)) {
      setMsg("Kod musi mieć dokładnie 3 cyfry");
      return;
    }

    setLoading(true);

    const { data: profile, error } = await findProfileByCode(trimmed);
    if (error || !profile) {
      setLoading(false);
      setMsg("Nie znaleziono profilu");
      return;
    }

    const newPoints = (profile.points ?? 0) + 1;

    const { error: updErr } = await supabase
      .from("profiles")
      .update({ points: newPoints })
      .eq("id", profile.id);

    setLoading(false);

    if (updErr) {
      setMsg(updErr.message);
      return;
    }

    setMsg(`Dodano punkt. Nowy stan: ${newPoints}`);
    setCode(""); // ⬅️ reset pola po dodaniu punktu
  }

  async function removePoint() {
    setMsg(null);
    const trimmed = code.trim();

    if (!/^\d{3}$/.test(trimmed)) {
      setMsg("Kod musi mieć dokładnie 3 cyfry");
      return;
    }

    setLoading(true);

    const { data: profile, error } = await findProfileByCode(trimmed);
    if (error || !profile) {
      setLoading(false);
      setMsg("Nie znaleziono profilu");
      return;
    }

    const current = profile.points ?? 0;
    const newPoints = Math.max(0, current - 1);

    const { error: updErr } = await supabase
      .from("profiles")
      .update({ points: newPoints })
      .eq("id", profile.id);

    setLoading(false);

    if (updErr) {
      setMsg(updErr.message);
      return;
    }

    setMsg(`Usunięto punkt. Nowy stan: ${newPoints}`);
    setCode(""); // ⬅️ reset pola po dodaniu punktu
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>PUNKTY</h1>

      <div style={styles.card}>
        <label style={styles.label}>WPISZ KOD (3 CYFRY)</label>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123"
          style={styles.input}
          inputMode="numeric"
        />

        <div style={styles.center}>
          <button onClick={addPoint} disabled={loading} style={styles.btnBlack}>
            {loading ? "..." : "DODAJ PUNKT"}
          </button>
        </div>

        <div style={styles.center}>
          <button onClick={removePoint} disabled={loading} style={styles.btnWhite}>
            USUŃ PUNKT
          </button>
        </div>

        {msg && <div style={styles.msg}>{msg}</div>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 520, margin: "0 auto", padding: 24, fontFamily: "system-ui" },
  h1: { letterSpacing: 4, fontWeight: 500, textAlign: "center" },
  card: { border: "1px solid #000", padding: 18, marginTop: 18 },

  label: { display: "block", letterSpacing: 2, fontSize: 12, marginBottom: 10 },
  input: {
    width: "100%",
    padding: 14,
    border: "1px solid #000",
    outline: "none",
    fontSize: 16,
    letterSpacing: 2,
  },

  center: { display: "flex", justifyContent: "center", marginTop: 12 },

  btnBlack: {
  width: "100%",          // ⬅️ KLUCZ
  height: 48,             // taka sama wysokość jak input
  background: "#000",
  color: "#fff",
  border: "1px solid #000",
  letterSpacing: 2,
  cursor: "pointer",
},

btnWhite: {
  width: "100%",          // ⬅️ KLUCZ
  height: 48,
  background: "#fff",
  color: "#000",
  border: "1px solid #000",
  letterSpacing: 2,
  cursor: "pointer",
},

  msg: { marginTop: 14, fontSize: 14, color: "#111", textAlign: "center" },
};