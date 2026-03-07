
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type Audience =
  | { type: "all" }
  | { type: "logged_in" }
  | { type: "points_gte"; value: number }
  | { type: "points_lt"; value: number };

type Job = {
  id: string;
  title: string;
  body: string;
  data: any;
  audience: Audience;
  status: "scheduled" | "sent" | "cancelled";
  send_at: string;
  repeat_cron: string | null;
  next_run_at: string;
  last_run_at: string | null;
  created_at: string;
};

function chip(on: boolean): React.CSSProperties {
  return {
    height: 36,
    padding: "0 12px",
    border: "1px solid #000",
    background: on ? "#000" : "#fff",
    color: on ? "#fff" : "#000",
    letterSpacing: 2,
    cursor: "pointer",
  };
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(v: string) {
  // v = "YYYY-MM-DDTHH:mm" w local time
  const d = new Date(v);
  return d.toISOString();
}

function cronFromRepeat(kind: "none" | "daily" | "weekly", timeHHMM: string, weekday: number) {
  // timeHHMM = "10:30"
  const [hh, mm] = timeHHMM.split(":").map((x) => Number(x));
  if (kind === "none") return null;

  // cron-parser: "m h dom mon dow"
  // daily: 30 10 * * *
  if (kind === "daily") return `${mm} ${hh} * * *`;

  // weekly: 30 10 * * 1  (Mon=1 ... Sun=0/7) -> my użyjemy 1-6 + 0
  // weekday: 0=Sun,1=Mon,...6=Sat
  return `${mm} ${hh} * * ${weekday}`;
}

export default function PushPage() {
  const [tab, setTab] = useState<"send" | "schedule">("send");

  // SEND NOW
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<Audience>({ type: "all" });
  const [points, setPoints] = useState("9");

  // SCHEDULE
  const [jobs, setJobs] = useState<Job[]>([]);
  const [schedTitle, setSchedTitle] = useState("");
  const [schedBody, setSchedBody] = useState("");
  const [schedMode, setSchedMode] = useState<Audience>({ type: "all" });
  const [schedPoints, setSchedPoints] = useState("9");

  const [whenLocal, setWhenLocal] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return toLocalInputValue(d.toISOString());
  });

  const [repeatKind, setRepeatKind] = useState<"none" | "daily" | "weekly">("none");
  const [repeatTime, setRepeatTime] = useState("10:00");
  const [weekday, setWeekday] = useState(1); // Mon default

  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const sendAudience: Audience =
    mode.type === "points_gte" || mode.type === "points_lt"
      ? { type: mode.type, value: Number(points || "0") }
      : mode;

  const schedAudience: Audience =
    schedMode.type === "points_gte" || schedMode.type === "points_lt"
      ? { type: schedMode.type, value: Number(schedPoints || "0") }
      : schedMode;

  async function sendNow() {
  setLoading(true);
  setMsg("");

  try {
    const res = await fetch(
      "https://wqkzxoxprbbbphtlnxzg.supabase.co/functions/v1/send_push",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
        }),
      }
    );

    const json = await res.json();

    if (!res.ok) {
      setMsg("Błąd: " + (json.error || "Nieznany"));
    } else {
      setMsg("Push wysłany");
    }
  } catch {
    setMsg("Błąd połączenia");
  }

  setLoading(false);
}

  async function loadJobs() {
    setLoading(true);
    setMsg("");

    const { data, error } = await supabase
      .from("push_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    setLoading(false);

    if (error) {
      setMsg("Błąd: " + error.message);
      return;
    }

    setJobs((data ?? []) as Job[]);
  }

  useEffect(() => {
    loadJobs();
  }, []);

  async function saveJob() {
    setLoading(true);
    setMsg("");

    const repeat_cron = cronFromRepeat(repeatKind, repeatTime, weekday);
    const send_at = localInputToIso(whenLocal);

    // next_run_at startowo = send_at (pierwsze odpalenie)
    const payload = {
      title: schedTitle.trim(),
      body: schedBody.trim(),
      data: { screen: "MENU" },
      audience: schedAudience,
      status: "scheduled",
      send_at,
      next_run_at: send_at,
      repeat_cron,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    };

    let res;
    if (editingId) {
      res = await supabase.from("push_jobs").update(payload).eq("id", editingId).select("*").single();
    } else {
      res = await supabase.from("push_jobs").insert(payload).select("*").single();
    }

    setLoading(false);

    if (res.error) {
      setMsg("Błąd: " + res.error.message);
      return;
    }

    setMsg(editingId ? "Zapisano zmiany" : "Dodano planowane powiadomienie");
    setEditingId(null);
    setSchedTitle("");
    setSchedBody("");
    setRepeatKind("none");
    await loadJobs();
  }

  function startEdit(j: Job) {
    setTab("schedule");
    setEditingId(j.id);
    setSchedTitle(j.title);
    setSchedBody(j.body);
    setSchedMode((j.audience as any) ?? { type: "all" });

    if ((j.audience as any)?.type === "points_gte" || (j.audience as any)?.type === "points_lt") {
      setSchedPoints(String((j.audience as any).value ?? 9));
    } else {
      setSchedPoints("9");
    }

    setWhenLocal(toLocalInputValue(j.send_at));

    if (!j.repeat_cron) {
      setRepeatKind("none");
    } else {
      // Prosty parser: rozpoznaj daily vs weekly po polu dow
      // cron: "m h * * *" (daily) albo "m h * * X" (weekly)
      const parts = j.repeat_cron.trim().split(/\s+/);
      if (parts.length === 5 && parts[2] === "*" && parts[3] === "*" && parts[4] === "*") {
        setRepeatKind("daily");
      } else {
        setRepeatKind("weekly");
        const dow = Number(parts[4]);
        setWeekday(Number.isFinite(dow) ? dow : 1);
      }
      const mm = parts[0].padStart(2, "0");
      const hh = parts[1].padStart(2, "0");
      setRepeatTime(`${hh}:${mm}`);
    }
  }

  async function cancelJob(id: string) {
    const ok = confirm("Anulować to zaplanowane powiadomienie?");
    if (!ok) return;

    setLoading(true);
    setMsg("");

    const { error } = await supabase.from("push_jobs").update({ status: "cancelled" }).eq("id", id);
    setLoading(false);

    if (error) {
      setMsg("Błąd: " + error.message);
      return;
    }

    await loadJobs();
  }

  async function deleteJob(id: string) {
    const ok = confirm("Usunąć ten wpis z historii?");
    if (!ok) return;

    setLoading(true);
    setMsg("");

    const { error } = await supabase.from("push_jobs").delete().eq("id", id);
    setLoading(false);

    if (error) {
      setMsg("Błąd: " + error.message);
      return;
    }

    await loadJobs();
  }

  const visibleJobs = useMemo(() => jobs, [jobs]);

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
      <h2 style={{ letterSpacing: 3, fontWeight: 500, textAlign: "center" }}>PUSH</h2>

      <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "1fr", border: "1px solid #000", marginTop: 18 }}>
        <button
          onClick={() => setTab("send")}
          style={{ height: 54, border: "none", cursor: "pointer", letterSpacing: 2, background: tab === "send" ? "#000" : "#fff", color: tab === "send" ? "#fff" : "#000" }}
        >
          WYŚLIJ TERAZ
        </button>
        <button
          onClick={() => setTab("schedule")}
          style={{ height: 54, border: "none", cursor: "pointer", letterSpacing: 2, background: tab === "schedule" ? "#000" : "#fff", color: tab === "schedule" ? "#fff" : "#000" }}
        >
          PLANOWANIE / HISTORIA
        </button>
      </div>

      {msg && <div style={{ marginTop: 14, fontSize: 14, textAlign: "center" }}>{msg}</div>}

      {tab === "send" && (
        <div style={{ border: "1px solid #000", padding: 18, marginTop: 18, background: "#fff" }}>
          <label style={{ display: "block", letterSpacing: 2, fontSize: 12, marginBottom: 10 }}>ODBIORCY</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setMode({ type: "all" })} style={chip(mode.type === "all")}>WSZYSCY</button>
            <button onClick={() => setMode({ type: "logged_in" })} style={chip(mode.type === "logged_in")}>TYLKO ZALOGOWANI</button>
            <button onClick={() => setMode({ type: "points_gte", value: Number(points || "0") })} style={chip(mode.type === "points_gte")}>POINTS &gt;= X</button>
            <button onClick={() => setMode({ type: "points_lt", value: Number(points || "0") })} style={chip(mode.type === "points_lt")}>POINTS &lt; X</button>
          </div>

          {(mode.type === "points_gte" || mode.type === "points_lt") && (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", letterSpacing: 2, fontSize: 12, marginBottom: 10 }}>X</label>
              <input
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                inputMode="numeric"
                style={{ width: "100%", padding: 14, border: "1px solid #000", outline: "none", fontSize: 16, letterSpacing: 2 }}
              />
            </div>
          )}

          <label style={{ display: "block", letterSpacing: 2, fontSize: 12, marginTop: 14, marginBottom: 10 }}>TYTUŁ</label>
          <input
            placeholder="Np. Lunch -30%"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", padding: 14, border: "1px solid #000", outline: "none", fontSize: 16, letterSpacing: 2 }}
          />

          <label style={{ display: "block", letterSpacing: 2, fontSize: 12, margin: "12px 0 10px" }}>TREŚĆ</label>
          <textarea
            placeholder="Np. Dzisiaj do 14:00 -30% na lunch"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ width: "100%", padding: 14, border: "1px solid #000", outline: "none", fontSize: 16, letterSpacing: 1, minHeight: 120 }}
            rows={5}
          />

          <button
            onClick={sendNow}
            disabled={loading || !title.trim() || !body.trim()}
            style={{
              width: "100%",
              height: 50,
              background: "#000",
              color: "#fff",
              border: "1px solid #000",
              letterSpacing: 2,
              cursor: "pointer",
              marginTop: 14,
              opacity: loading || !title.trim() || !body.trim() ? 0.6 : 1,
            }}
          >
            {loading ? "Wysyłanie..." : "WYŚLIJ PUSH"}
          </button>
        </div>
      )}

      {tab === "schedule" && (
        <>
          <div style={{ border: "1px solid #000", padding: 18, marginTop: 18, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ letterSpacing: 2, fontSize: 12 }}>
                {editingId ? "EDYCJA POWIADOMIENIA" : "DODAJ POWIADOMIENIE"}
              </div>
              <button
                style={{ height: 36, padding: "0 12px", border: "1px solid #000", background: "#fff", cursor: "pointer", letterSpacing: 2 }}
                onClick={loadJobs}
                disabled={loading}
              >
                {loading ? "..." : "ODŚWIEŻ LISTĘ"}
              </button>
            </div>

            <label style={{ display: "block", letterSpacing: 2, fontSize: 12, marginTop: 14, marginBottom: 10 }}>
              ODBIORCY
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setSchedMode({ type: "all" })} style={chip(schedMode.type === "all")}>WSZYSCY</button>
              <button onClick={() => setSchedMode({ type: "logged_in" })} style={chip(schedMode.type === "logged_in")}>TYLKO ZALOGOWANI</button>
              <button onClick={() => setSchedMode({ type: "points_gte", value: Number(schedPoints || "0") })} style={chip(schedMode.type === "points_gte")}>POINTS &gt;= X</button>
              <button onClick={() => setSchedMode({ type: "points_lt", value: Number(schedPoints || "0") })} style={chip(schedMode.type === "points_lt")}>POINTS &lt; X</button>
            </div>

            {(schedMode.type === "points_gte" || schedMode.type === "points_lt") && (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: "block", letterSpacing: 2, fontSize: 12, marginBottom: 10 }}>X</label>
                <input
                  value={schedPoints}
                  onChange={(e) => setSchedPoints(e.target.value)}
                  inputMode="numeric"
                  style={{ width: "100%", padding: 14, border: "1px solid #000", outline: "none", fontSize: 16, letterSpacing: 2 }}
                />
              </div>
            )}

            <label style={{ display: "block", letterSpacing: 2, fontSize: 12, marginTop: 14, marginBottom: 10 }}>
              DATA I GODZINA (pierwsze wysłanie)
            </label>
            <input
              type="datetime-local"
              value={whenLocal}
              onChange={(e) => setWhenLocal(e.target.value)}
              style={{ width: "100%", padding: 14, border: "1px solid #000", outline: "none", fontSize: 16, letterSpacing: 1 }}
            />

            <label style={{ display: "block", letterSpacing: 2, fontSize: 12, marginTop: 14, marginBottom: 10 }}>
              POWTARZANIE
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setRepeatKind("none")} style={chip(repeatKind === "none")}>BRAK</button>
              <button onClick={() => setRepeatKind("daily")} style={chip(repeatKind === "daily")}>CODZIENNIE</button>
              <button onClick={() => setRepeatKind("weekly")} style={chip(repeatKind === "weekly")}>CO TYDZIEŃ</button>
            </div>

            {repeatKind !== "none" && (
              <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px" }}>
                  <label style={{ display: "block", letterSpacing: 2, fontSize: 12, marginBottom: 10 }}>GODZINA</label>
                  <input
                    type="time"
                    value={repeatTime}
                    onChange={(e) => setRepeatTime(e.target.value)}
                    style={{ width: "100%", padding: 14, border: "1px solid #000", outline: "none", fontSize: 16 }}
                  />
                </div>

                {repeatKind === "weekly" && (
                  <div style={{ flex: "1 1 220px" }}>
                    <label style={{ display: "block", letterSpacing: 2, fontSize: 12, marginBottom: 10 }}>DZIEŃ</label>
                    <select
                      value={weekday}
                      onChange={(e) => setWeekday(Number(e.target.value))}
                      style={{ width: "100%", padding: 14, border: "1px solid #000", outline: "none", fontSize: 16 }}
                    >
                      <option value={1}>Poniedziałek</option>
                      <option value={2}>Wtorek</option>
                      <option value={3}>Środa</option>
                      <option value={4}>Czwartek</option>
                      <option value={5}>Piątek</option>
                      <option value={6}>Sobota</option>
                      <option value={0}>Niedziela</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            <label style={{ display: "block", letterSpacing: 2, fontSize: 12, marginTop: 14, marginBottom: 10 }}>
              TYTUŁ
            </label>
            <input
              value={schedTitle}
              onChange={(e) => setSchedTitle(e.target.value)}
              style={{ width: "100%", padding: 14, border: "1px solid #000", outline: "none", fontSize: 16, letterSpacing: 2 }}
            />

            <label style={{ display: "block", letterSpacing: 2, fontSize: 12, margin: "12px 0 10px" }}>
              TREŚĆ
            </label>
            <textarea
              value={schedBody}
              onChange={(e) => setSchedBody(e.target.value)}
              rows={5}
              style={{ width: "100%", padding: 14, border: "1px solid #000", outline: "none", fontSize: 16, minHeight: 120 }}
            />

            <button
              onClick={saveJob}
              disabled={loading || !schedTitle.trim() || !schedBody.trim() || !whenLocal}
              style={{
                width: "100%",
                height: 50,
                background: "#000",
                color: "#fff",
                border: "1px solid #000",
                letterSpacing: 2,
                cursor: "pointer",
                marginTop: 14,
                opacity: loading || !schedTitle.trim() || !schedBody.trim() || !whenLocal ? 0.6 : 1,
              }}
            >
              {loading ? "..." : editingId ? "ZAPISZ ZMIANY" : "DODAJ PLANOWANE"}
            </button>

            {editingId && (
              <button
                onClick={() => {
                  setEditingId(null);
                  setSchedTitle("");
                  setSchedBody("");
                  setSchedMode({ type: "all" });
                  setSchedPoints("9");
                  setRepeatKind("none");
                  setMsg("");
                }}
                style={{
                  width: "100%",
                  height: 46,
                  background: "#fff",
                  color: "#000",
                  border: "1px solid #000",
                  letterSpacing: 2,
                  cursor: "pointer",
                  marginTop: 10,
                }}
              >
                ANULUJ EDYCJĘ
              </button>
            )}
          </div>

          <div style={{ border: "1px solid #000", marginTop: 18 }}>
            <div style={{ display: "flex", borderBottom: "1px solid #000", padding: 12, fontWeight: 500 }}>
              <div style={{ width: 110 }}>STATUS</div>
              <div style={{ width: 200 }}>NEXT RUN</div>
              <div style={{ width: 160 }}>REPEAT</div>
              <div style={{ flex: 1 }}>TYTUŁ</div>
              <div style={{ width: 220 }}>AKCJE</div>
            </div>

            {visibleJobs.map((j) => (
              <div key={j.id} style={{ display: "flex", padding: 12, borderBottom: "1px solid #E5E7EB", alignItems: "center" }}>
                <div style={{ width: 110, letterSpacing: 1 }}>{j.status}</div>
                <div style={{ width: 200, fontSize: 12 }}>{new Date(j.next_run_at).toLocaleString()}</div>
                <div style={{ width: 160, fontSize: 12 }}>{j.repeat_cron ?? "-"}</div>
                <div style={{ flex: 1, fontSize: 12 }}>{j.title}</div>

                <div style={{ width: 220, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    onClick={() => startEdit(j)}
                    disabled={loading}
                    style={{ height: 36, padding: "0 12px", border: "1px solid #000", background: "#fff", cursor: "pointer", letterSpacing: 2 }}
                  >
                    EDYTUJ
                  </button>

                  {j.status === "scheduled" && (
                    <button
                      onClick={() => cancelJob(j.id)}
                      disabled={loading}
                      style={{ height: 36, padding: "0 12px", border: "1px solid #DC2626", background: "#fff", color: "#DC2626", cursor: "pointer", letterSpacing: 2 }}
                    >
                      ANULUJ
                    </button>
                  )}

                  <button
                    onClick={() => deleteJob(j.id)}
                    disabled={loading}
                    style={{ height: 36, padding: "0 12px", border: "1px solid #DC2626", background: "#fff", color: "#DC2626", cursor: "pointer", letterSpacing: 2 }}
                  >
                    USUŃ
                  </button>
                </div>
              </div>
            ))}

            {visibleJobs.length === 0 && <div style={{ padding: 16, textAlign: "center" }}>Brak wpisów</div>}
          </div>
        </>
      )}
    </div>
  );
}