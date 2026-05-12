import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

type LoyaltyEvent = {
  id: string;
  profile_id: string;
  staff_id: string | null;
  delta: number;
  points_after: number;
  reason: string;
  created_at: string;
};

type ProfileSummary = {
  id: string;
  email: string | null;
  short_code: string | null;
};

function formatEventReason(reason: string) {
  if (reason === "reward_redemption") return "NAGRODA";
  return "PUNKTY";
}

export default function PointsPage() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<LoyaltyEvent[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileSummary>>({});
  const [eventsMsg, setEventsMsg] = useState<string | null>(null);

  // --- pull-to-refresh (web) ---
  const touchStartY = useRef<number | null>(null);

  async function findProfileByCode(short_code: string) {
    return await supabase
      .from("profiles")
      .select("id, points")
      .eq("short_code", short_code)
      .single();
  }

  async function loadEvents() {
    const { data, error } = await supabase
      .from("loyalty_events")
      .select("id, profile_id, staff_id, delta, points_after, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setEventsMsg(error.message);
      return;
    }

    const nextEvents = (data ?? []) as LoyaltyEvent[];
    setEvents(nextEvents);
    setEventsMsg(null);

    const profileIds = Array.from(
      new Set(
        nextEvents.flatMap((event) => [
          event.profile_id,
          event.staff_id,
        ]).filter(Boolean) as string[]
      )
    );

    if (profileIds.length === 0) {
      setProfilesById({});
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, short_code")
      .in("id", profileIds);

    setProfilesById(
      Object.fromEntries(
        ((profiles ?? []) as ProfileSummary[]).map((profile) => [profile.id, profile])
      )
    );
  }

  async function adjustPoint(delta: 1 | -1) {
    const trimmed = code.trim();

    if (!/^\d{3}$/.test(trimmed)) {
      setMsg("Kod musi mieć dokładnie 3 cyfry");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .rpc("staff_adjust_points_by_code", {
        p_short_code: trimmed,
        p_delta: delta,
      })
      .single();

    setLoading(false);

    if (error || !data) {
      setMsg(error?.message ?? "Nie znaleziono profilu");
      return;
    }

    const newPoints = (data as { points: number }).points ?? 0;
    setMsg(delta === 1 ? `Dodano punkt. Nowy stan: ${newPoints}` : `Usunięto punkt. Nowy stan: ${newPoints}`);
    setCode("");
    await loadEvents();
  }

  async function redeemReward() {
    const trimmed = code.trim();

    if (!/^\d{3}$/.test(trimmed)) {
      setMsg("Kod musi mieć dokładnie 3 cyfry");
      return;
    }

    const ok = confirm("Odebrać nagrodę i odjąć 10 punktów?");
    if (!ok) return;

    setLoading(true);

    const { data, error } = await supabase
      .rpc("staff_redeem_reward_by_code", {
        p_short_code: trimmed,
      })
      .single();

    setLoading(false);

    if (error || !data) {
      setMsg(error?.message ?? "Nie udało się odebrać nagrody");
      return;
    }

    const newPoints = (data as { points: number }).points ?? 0;
    setMsg(`Odebrano nagrodę. Nowy stan: ${newPoints}`);
    setCode("");
    await loadEvents();
  }

  // odświeżenie “stanu” dla aktualnie wpisanego kodu (jeśli jest poprawny)
  async function refresh() {
    const trimmed = code.trim();
    if (!/^\d{3}$/.test(trimmed)) return; // nie spamujemy supabase jak kod pusty/zły

    setRefreshing(true);
    const { data: profile, error } = await findProfileByCode(trimmed);
    setRefreshing(false);

    if (error || !profile) {
      setMsg("Nie znaleziono profilu");
      return;
    }

    setMsg(`Aktualny stan: ${profile.points ?? 0}`);
  }

  function onTouchStart(e: React.TouchEvent) {
    // tylko gdy jesteśmy na samej górze strony (jak pull-to-refresh)
    if (window.scrollY <= 0) touchStartY.current = e.touches[0].clientY;
    else touchStartY.current = null;
  }

  async function onTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const endY = e.changedTouches[0].clientY;
    const delta = endY - touchStartY.current;

    // próg “pociągnięcia”
    if (delta > 80) {
      await refresh();
    }
    touchStartY.current = null;
  }

  useEffect(() => {
    loadEvents();
  }, []);

  async function addPoint() {
    setMsg(null);
    await adjustPoint(1);
  }

  async function removePoint() {
    setMsg(null);
    await adjustPoint(-1);
  }

  async function redeem() {
    setMsg(null);
    await redeemReward();
  }

  async function clearEvents() {
    const ok = confirm("Wyczyścić całą historię operacji punktowych?");
    if (!ok) return;

    setLoading(true);
    setEventsMsg(null);

    const { data, error } = await supabase.rpc("admin_clear_loyalty_events");

    setLoading(false);

    if (error) {
      setEventsMsg("Błąd: " + error.message);
      return;
    }

    setEvents([]);
    setProfilesById({});
    setEventsMsg(
      typeof data === "number"
        ? `Wyczyszczono historię (${data})`
        : "Wyczyszczono historię"
    );
  }

  return (
    <div
      style={styles.page}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <h1 style={styles.h1}>PUNKTY</h1>

      <div style={styles.card}>
        <label style={styles.label}>
          WPISZ KOD (3 CYFRY){refreshing ? " • ODŚWIEŻAM…" : ""}
        </label>

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

        <div style={styles.secondaryActions}>
          <button onClick={removePoint} disabled={loading} style={styles.btnSecondary}>
            USUŃ PUNKT
          </button>

          <button onClick={redeem} disabled={loading} style={styles.btnSecondary}>
            ODBIERZ NAGRODĘ (-10)
          </button>
        </div>

        {msg && <div style={styles.msg}>{msg}</div>}
      </div>

      <div style={styles.historyCard}>
        <div style={styles.historyHead}>
          <div style={styles.historyTitle}>OSTATNIE OPERACJE</div>
          <div style={styles.historyActions}>
            <button onClick={loadEvents} style={styles.refreshBtn} disabled={loading}>
              ODŚWIEŻ
            </button>
            <button onClick={clearEvents} style={styles.refreshBtn} disabled={loading}>
              WYCZYŚĆ
            </button>
          </div>
        </div>

        {eventsMsg && <div style={styles.msg}>{eventsMsg}</div>}

        <div style={styles.historyTable}>
          <div style={styles.historyRowHead}>
            <div style={styles.dateCol}>DATA</div>
            <div style={styles.userCol}>KLIENT</div>
            <div style={styles.deltaCol}>ZMIANA</div>
            <div style={styles.staffCol}>STAFF</div>
          </div>

          {events.map((event) => {
            const profile = profilesById[event.profile_id];
            const staff = event.staff_id ? profilesById[event.staff_id] : null;
            const deltaText = event.delta > 0 ? `+${event.delta}` : String(event.delta);
            const reason = formatEventReason(event.reason);

            return (
              <div key={event.id} style={styles.historyRow}>
                <div style={styles.dateCol}>{new Date(event.created_at).toLocaleString()}</div>
                <div style={styles.userCol}>
                  {profile?.short_code ? `${profile.short_code} · ` : ""}
                  {profile?.email ?? event.profile_id}
                </div>
                <div style={styles.deltaCol}>
                  <div>{reason}</div>
                  <div>
                    {deltaText} → {event.points_after}
                  </div>
                </div>
                <div style={styles.staffCol}>{staff?.email ?? event.staff_id ?? "-"}</div>
              </div>
            );
          })}

          {events.length === 0 && !eventsMsg && (
            <div style={{ padding: 16, textAlign: "center" }}>
              Brak operacji punktowych
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 860, margin: "0 auto", padding: 24, fontFamily: "system-ui" },
  h1: { letterSpacing: 4, fontWeight: 500, textAlign: "center" },
  card: { border: "1px solid #000", padding: 18, margin: "18px auto 0", maxWidth: 520 },

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
  secondaryActions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 },

  btnBlack: {
    width: "100%",
    height: 48,
    background: "#000",
    color: "#fff",
    border: "1px solid #000",
    letterSpacing: 2,
    cursor: "pointer",
  },

  btnSecondary: {
    width: "100%",
    minHeight: 44,
    background: "#fff",
    color: "#000",
    border: "1px solid #000",
    letterSpacing: 2,
    fontSize: 12,
    padding: "0 10px",
    cursor: "pointer",
  },

  msg: { marginTop: 14, fontSize: 14, color: "#111", textAlign: "center" },
  historyCard: { border: "1px solid #000", padding: 18, marginTop: 34, background: "#fff" },
  historyHead: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  historyTitle: { letterSpacing: 2, fontSize: 12 },
  historyActions: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
  refreshBtn: { border: "1px solid #000", background: "#fff", padding: "10px 12px", letterSpacing: 2, cursor: "pointer" },
  historyTable: { border: "1px solid #000", marginTop: 20, overflowX: "auto" },
  historyRowHead: { display: "flex", minWidth: 760, borderBottom: "1px solid #000", padding: 12, fontWeight: 500 },
  historyRow: { display: "flex", minWidth: 760, borderBottom: "1px solid #E5E7EB", padding: 12, fontSize: 12 },
  dateCol: { width: 190 },
  userCol: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  deltaCol: { width: 110, textAlign: "center" },
  staffCol: { width: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
};
