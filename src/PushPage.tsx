import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type Audience =
  | { type: "all" }
  | { type: "has_account" }
  | { type: "no_account" }
  | { type: "points_eq"; value: number }
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

type Campaign = {
  id: string;
  title: string;
  body: string;
  data: any;
  audience: any;
  tokens: number;
  sent: number;
  created_at: string;
};

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function localInputToIso(v: string) {
  const d = new Date(v); // local time
  return d.toISOString();
}

function cronFromRepeat(
  kind: "none" | "daily" | "weekly",
  timeHHMM: string,
  weekday: number
) {
  const [hh, mm] = timeHHMM.split(":").map((x) => Number(x));
  if (kind === "none") return null;
  if (kind === "daily") return `${mm} ${hh} * * *`;
  return `${mm} ${hh} * * ${weekday}`; // weekly
}

function Ellipsis({
  children,
  style,
  title,
}: {
  children: any;
  style?: React.CSSProperties;
  title?: string;
}) {
  return (
    <div
      title={title}
      style={{
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function formatAudience(a: Audience): string {
  if (!a) return "WSZYSCY";
  if (a.type === "all") return "WSZYSCY";
  if (a.type === "has_account") return "Z KONTA";
  if (a.type === "no_account") return "BEZ KONTA";
  if (a.type === "points_eq") return `POINTS = ${a.value ?? 0}`;
  if (a.type === "points_gte") return `POINTS >= ${a.value ?? 0}`;
  if (a.type === "points_lt") return `POINTS < ${a.value ?? 0}`;
  return "WSZYSCY";
}

function AudienceDropdown({
  value,
  onChange,
  pointsValue,
  onChangePoints,
  label,
}: {
  value: Audience;
  onChange: (a: Audience) => void;
  pointsValue: string;
  onChangePoints: (v: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  const options: { key: Audience["type"]; label: string }[] = [
    { key: "all", label: "WSZYSCY" },
    { key: "has_account", label: "Z KONTA" },
    { key: "no_account", label: "BEZ KONTA" },
    { key: "points_eq", label: "POINTS = X" },
    { key: "points_gte", label: "POINTS >= X" },
    { key: "points_lt", label: "POINTS < X" },
  ];

  const isPoints =
    value.type === "points_eq" ||
    value.type === "points_gte" ||
    value.type === "points_lt";

  return (
    <div style={{ marginTop: 14 }}>
      <label
        style={{
          display: "block",
          letterSpacing: 2,
          fontSize: 12,
          marginBottom: 10,
        }}
      >
        {label}
      </label>

      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          style={{
            width: "100%",
            height: 50,
            border: "1px solid #000",
            background: "#fff",
            cursor: "pointer",
            letterSpacing: 2,
            padding: "0 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 12 }}>{formatAudience(value)}</span>
          <span style={{ fontSize: 14, lineHeight: 1 }}>{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div
            style={{
              position: "absolute",
              top: 52,
              left: 0,
              right: 0,
              border: "1px solid #000",
              background: "#fff",
              zIndex: 20,
            }}
          >
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (o.key === "points_eq" || o.key === "points_gte" || o.key === "points_lt") {
                    onChange({ type: o.key, value: Number(pointsValue || "0") } as any);
                  } else {
                    onChange({ type: o.key } as any);
                  }
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 14px",
                  border: "none",
                  background: "#fff",
                  cursor: "pointer",
                  letterSpacing: 2,
                  fontSize: 12,
                  borderBottom: "1px solid #E5E7EB",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isPoints && (
        <div style={{ marginTop: 12 }}>
          <label
            style={{
              display: "block",
              letterSpacing: 2,
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            X
          </label>
          <input
            value={pointsValue}
            onChange={(e) => onChangePoints(e.target.value)}
            inputMode="numeric"
            style={{
              width: "100%",
              padding: 14,
              border: "1px solid #000",
              outline: "none",
              fontSize: 16,
              letterSpacing: 2,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function PushPage() {
  const [tab, setTab] = useState<"send" | "schedule" | "history">("send");

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
  const [weekday, setWeekday] = useState(1);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // HISTORY
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [opensByCampaign, setOpensByCampaign] = useState<Record<string, number>>({});
  const [expandedBody, setExpandedBody] = useState<Record<string, boolean>>({});

  const sendAudience: Audience =
    mode.type === "points_eq" || mode.type === "points_gte" || mode.type === "points_lt"
      ? { type: mode.type, value: Number(points || "0") }
      : mode;

  const schedAudience: Audience =
    schedMode.type === "points_eq" || schedMode.type === "points_gte" || schedMode.type === "points_lt"
      ? { type: schedMode.type, value: Number(schedPoints || "0") }
      : schedMode;

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

  async function loadHistory() {
    // kampanie wysłane (push_campaigns) + policz opens z push_opens
    const { data: camps, error } = await supabase
      .from("push_campaigns")
      .select("id,title,body,data,audience,tokens,sent,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setMsg("Błąd: " + error.message);
      return;
    }

    const list = (camps ?? []) as Campaign[];
    setCampaigns(list);

    const ids = list.map((c) => c.id).filter(Boolean);
    if (ids.length === 0) {
      setOpensByCampaign({});
      return;
    }

    // pobierz opens dla tych kampanii i policz w JS
    const { data: opens, error: opensErr } = await supabase
      .from("push_opens")
      .select("campaign_id")
      .in("campaign_id", ids)
      .limit(20000);

    if (opensErr) {
      // nie blokuj UI – po prostu brak opens
      setOpensByCampaign({});
      return;
    }

    const map: Record<string, number> = {};
    for (const r of opens ?? []) {
      const cid = (r as any).campaign_id as string;
      if (!cid) continue;
      map[cid] = (map[cid] ?? 0) + 1;
    }
    setOpensByCampaign(map);
  }

  useEffect(() => {
    loadJobs();
    loadHistory();
  }, []);

  async function sendNow() {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch(
        "https://wqkzxoxprbbbphtlnxzg.supabase.co/functions/v1/send_push",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": import.meta.env.VITE_PUSH_ADMIN_SECRET ?? "",
          },
          body: JSON.stringify({
            title: title.trim(),
            body: body.trim(),
            data: { screen: "MENU" },
            audience: sendAudience,
          }),
        }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg("Błąd: " + (json.error || JSON.stringify(json) || "Nieznany"));
      } else {
        setMsg(`Push wysłany (${json.tokens} urządzeń)`);
        setTitle("");
        setBody("");
        // odśwież historię (żeby od razu było w zakładce HISTORIA)
        await loadHistory();
      }
    } catch {
      setMsg("Błąd połączenia");
    }

    setLoading(false);
  }

  async function saveJob() {
    setLoading(true);
    setMsg("");

    const repeat_cron = cronFromRepeat(repeatKind, repeatTime, weekday);
    const send_at = localInputToIso(whenLocal);

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
      res = await supabase
        .from("push_jobs")
        .update(payload)
        .eq("id", editingId)
        .select("*")
        .single();
    } else {
      res = await supabase
        .from("push_jobs")
        .insert(payload)
        .select("*")
        .single();
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

    const t = (j.audience as any)?.type;
    if (t === "points_eq" || t === "points_gte" || t === "points_lt") {
      setSchedPoints(String((j.audience as any).value ?? 9));
    } else {
      setSchedPoints("9");
    }

    setWhenLocal(toLocalInputValue(j.send_at));

    if (!j.repeat_cron) {
      setRepeatKind("none");
    } else {
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
    const ok = confirm("Usunąć ten wpis?");
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

  async function deleteCampaign(id: string) {
    const ok = confirm("Usunąć ten wpis z historii?");
    if (!ok) return;

    setLoading(true);
    setMsg("");

    // jeśli masz FK cascade z push_opens -> push_campaigns, to opens same się usuną
    const { error } = await supabase.from("push_campaigns").delete().eq("id", id);

    setLoading(false);

    if (error) {
      setMsg("Błąd: " + error.message);
      return;
    }

    await loadHistory();
  }

  const scheduledJobs = useMemo(
    () => jobs.filter((j) => j.status === "scheduled"),
    [jobs]
  );

  const sentHistory = useMemo(() => campaigns, [campaigns]);

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: 24,
        fontFamily: "system-ui",
      }}
    >
      <h2 style={{ letterSpacing: 3, fontWeight: 500, textAlign: "center" }}>
        PUSH
      </h2>

      <div
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "1fr",
          border: "1px solid #000",
          marginTop: 18,
        }}
      >
        <button
          onClick={() => setTab("send")}
          style={{
            height: 54,
            border: "none",
            cursor: "pointer",
            letterSpacing: 2,
            background: tab === "send" ? "#000" : "#fff",
            color: tab === "send" ? "#fff" : "#000",
          }}
        >
          WYŚLIJ TERAZ
        </button>
        <button
          onClick={() => setTab("schedule")}
          style={{
            height: 54,
            border: "none",
            cursor: "pointer",
            letterSpacing: 2,
            background: tab === "schedule" ? "#000" : "#fff",
            color: tab === "schedule" ? "#fff" : "#000",
          }}
        >
          PLANOWANIE
        </button>
        <button
          onClick={() => setTab("history")}
          style={{
            height: 54,
            border: "none",
            cursor: "pointer",
            letterSpacing: 2,
            background: tab === "history" ? "#000" : "#fff",
            color: tab === "history" ? "#fff" : "#000",
          }}
        >
          HISTORIA
        </button>
      </div>

      {msg && (
        <div style={{ marginTop: 14, fontSize: 14, textAlign: "center" }}>
          {msg}
        </div>
      )}

      {/* ========================= SEND NOW ========================= */}
      {tab === "send" && (
        <div
          style={{
            border: "1px solid #000",
            padding: 18,
            marginTop: 18,
            background: "#fff",
          }}
        >
          <AudienceDropdown
            value={mode}
            onChange={(a) => setMode(a)}
            pointsValue={points}
            onChangePoints={setPoints}
            label="ODBIORCY"
          />

          <label
            style={{
              display: "block",
              letterSpacing: 2,
              fontSize: 12,
              marginTop: 14,
              marginBottom: 10,
            }}
          >
            TYTUŁ
          </label>
          <input
            placeholder="Np. Lunch -30%"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: "100%",
              padding: 14,
              border: "1px solid #000",
              outline: "none",
              fontSize: 16,
              letterSpacing: 2,
            }}
          />

          <label
            style={{
              display: "block",
              letterSpacing: 2,
              fontSize: 12,
              margin: "12px 0 10px",
            }}
          >
            TREŚĆ
          </label>
          <textarea
            placeholder="Np. Dzisiaj do 14:00 -30% na lunch"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{
              width: "100%",
              padding: 14,
              border: "1px solid #000",
              outline: "none",
              fontSize: 16,
              letterSpacing: 1,
              minHeight: 120,
            }}
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

      {/* ========================= SCHEDULE ========================= */}
      {tab === "schedule" && (
        <>
          <div
            style={{
              border: "1px solid #000",
              padding: 18,
              marginTop: 18,
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ letterSpacing: 2, fontSize: 12 }}>
                {editingId ? "EDYCJA POWIADOMIENIA" : "DODAJ POWIADOMIENIE"}
              </div>
              <button
                style={{
                  height: 36,
                  padding: "0 12px",
                  border: "1px solid #000",
                  background: "#fff",
                  cursor: "pointer",
                  letterSpacing: 2,
                }}
                onClick={async () => {
                  await loadJobs();
                  await loadHistory();
                }}
                disabled={loading}
              >
                {loading ? "..." : "ODŚWIEŻ"}
              </button>
            </div>

            <AudienceDropdown
              value={schedMode}
              onChange={(a) => setSchedMode(a)}
              pointsValue={schedPoints}
              onChangePoints={setSchedPoints}
              label="ODBIORCY"
            />

            <label
              style={{
                display: "block",
                letterSpacing: 2,
                fontSize: 12,
                marginTop: 14,
                marginBottom: 10,
              }}
            >
              DATA I GODZINA (pierwsze wysłanie)
            </label>
            <input
              type="datetime-local"
              value={whenLocal}
              onChange={(e) => setWhenLocal(e.target.value)}
              style={{
                width: "100%",
                padding: 14,
                border: "1px solid #000",
                outline: "none",
                fontSize: 16,
                letterSpacing: 1,
              }}
            />

            <label
              style={{
                display: "block",
                letterSpacing: 2,
                fontSize: 12,
                marginTop: 14,
                marginBottom: 10,
              }}
            >
              POWTARZANIE
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => setRepeatKind("none")}
                style={{
                  height: 36,
                  padding: "0 12px",
                  border: "1px solid #000",
                  background: repeatKind === "none" ? "#000" : "#fff",
                  color: repeatKind === "none" ? "#fff" : "#000",
                  letterSpacing: 2,
                  cursor: "pointer",
                }}
              >
                BRAK
              </button>
              <button
                onClick={() => setRepeatKind("daily")}
                style={{
                  height: 36,
                  padding: "0 12px",
                  border: "1px solid #000",
                  background: repeatKind === "daily" ? "#000" : "#fff",
                  color: repeatKind === "daily" ? "#fff" : "#000",
                  letterSpacing: 2,
                  cursor: "pointer",
                }}
              >
                CODZIENNIE
              </button>
              <button
                onClick={() => setRepeatKind("weekly")}
                style={{
                  height: 36,
                  padding: "0 12px",
                  border: "1px solid #000",
                  background: repeatKind === "weekly" ? "#000" : "#fff",
                  color: repeatKind === "weekly" ? "#fff" : "#000",
                  letterSpacing: 2,
                  cursor: "pointer",
                }}
              >
                CO TYDZIEŃ
              </button>
            </div>

            {repeatKind !== "none" && (
              <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px" }}>
                  <label style={{ display: "block", letterSpacing: 2, fontSize: 12, marginBottom: 10 }}>
                    GODZINA
                  </label>
                  <input
                    type="time"
                    value={repeatTime}
                    onChange={(e) => setRepeatTime(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 14,
                      border: "1px solid #000",
                      outline: "none",
                      fontSize: 16,
                    }}
                  />
                </div>

                {repeatKind === "weekly" && (
                  <div style={{ flex: "1 1 220px" }}>
                    <label style={{ display: "block", letterSpacing: 2, fontSize: 12, marginBottom: 10 }}>
                      DZIEŃ
                    </label>
                    <select
                      value={weekday}
                      onChange={(e) => setWeekday(Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: 14,
                        border: "1px solid #000",
                        outline: "none",
                        fontSize: 16,
                        background: "#fff",
                      }}
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
              style={{
                width: "100%",
                padding: 14,
                border: "1px solid #000",
                outline: "none",
                fontSize: 16,
                letterSpacing: 2,
              }}
            />

            <label style={{ display: "block", letterSpacing: 2, fontSize: 12, margin: "12px 0 10px" }}>
              TREŚĆ
            </label>
            <textarea
              value={schedBody}
              onChange={(e) => setSchedBody(e.target.value)}
              rows={5}
              style={{
                width: "100%",
                padding: 14,
                border: "1px solid #000",
                outline: "none",
                fontSize: 16,
                minHeight: 120,
              }}
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

          <div style={{ marginTop: 18, letterSpacing: 2, fontSize: 12 }}>
            ZAPLANOWANE POWIADOMIENIA:
          </div>

          <div style={{ border: "1px solid #000", marginTop: 10 }}>
            <div style={{ display: "flex", borderBottom: "1px solid #000", padding: 12, fontWeight: 500 }}>
              <div style={{ width: 110 }}>STATUS</div>
              <div style={{ width: 200 }}>NEXT RUN</div>
              <div style={{ width: 160 }}>REPEAT</div>
              <div style={{ width: 160 }}>ODBIORCY</div>
              <div style={{ flex: 1 }}>TYTUŁ</div>
              <div style={{ width: 240 }}>AKCJE</div>
            </div>

            {scheduledJobs.map((j) => {
              const isOpen = !!expandedBody[j.id];
              return (
                <div key={j.id} style={{ borderBottom: "1px solid #E5E7EB" }}>
                  <div style={{ display: "flex", padding: 12, alignItems: "center" }}>
                    <div style={{ width: 110, letterSpacing: 1 }}>{j.status}</div>
                    <div style={{ width: 200, fontSize: 12 }}>{new Date(j.next_run_at).toLocaleString()}</div>
                    <div style={{ width: 160, fontSize: 12 }}>{j.repeat_cron ?? "-"}</div>
                    <div style={{ width: 160, fontSize: 12 }}>
                      <Ellipsis title={formatAudience(j.audience)}>{formatAudience(j.audience)}</Ellipsis>
                    </div>

                    <div style={{ flex: 1, fontSize: 12 }}>
                      <Ellipsis title={j.title}>{j.title}</Ellipsis>
                    </div>

                    <div style={{ width: 240, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button
                        onClick={() =>
                          setExpandedBody((m) => ({ ...m, [j.id]: !m[j.id] }))
                        }
                        disabled={loading}
                        style={{
                          height: 36,
                          padding: "0 12px",
                          border: "1px solid #000",
                          background: "#fff",
                          cursor: "pointer",
                          letterSpacing: 2,
                        }}
                      >
                        {isOpen ? "ZWIŃ" : "PODGLĄD"}
                      </button>

                      <button
                        onClick={() => startEdit(j)}
                        disabled={loading}
                        style={{
                          height: 36,
                          padding: "0 12px",
                          border: "1px solid #000",
                          background: "#fff",
                          cursor: "pointer",
                          letterSpacing: 2,
                        }}
                      >
                        EDYTUJ
                      </button>

                      <button
                        onClick={() => cancelJob(j.id)}
                        disabled={loading}
                        style={{
                          height: 36,
                          padding: "0 12px",
                          border: "1px solid #DC2626",
                          background: "#fff",
                          color: "#DC2626",
                          cursor: "pointer",
                          letterSpacing: 2,
                        }}
                      >
                        ANULUJ
                      </button>

                      <button
                        onClick={() => deleteJob(j.id)}
                        disabled={loading}
                        style={{
                          height: 36,
                          padding: "0 12px",
                          border: "1px solid #DC2626",
                          background: "#fff",
                          color: "#DC2626",
                          cursor: "pointer",
                          letterSpacing: 2,
                        }}
                      >
                        USUŃ
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ padding: "0 12px 12px 12px", fontSize: 12, color: "#111" }}>
                      <div style={{ letterSpacing: 2, fontSize: 11, marginBottom: 6 }}>
                        TREŚĆ:
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                        {j.body}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {scheduledJobs.length === 0 && (
              <div style={{ padding: 16, textAlign: "center" }}>
                Brak zaplanowanych powiadomień
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================= HISTORY ========================= */}
      {tab === "history" && (
        <>
          <div
            style={{
              border: "1px solid #000",
              padding: 18,
              marginTop: 18,
              background: "#fff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ letterSpacing: 2, fontSize: 12 }}>HISTORIA WYSŁANYCH</div>
            <button
              style={{
                height: 36,
                padding: "0 12px",
                border: "1px solid #000",
                background: "#fff",
                cursor: "pointer",
                letterSpacing: 2,
              }}
              onClick={loadHistory}
              disabled={loading}
            >
              {loading ? "..." : "ODŚWIEŻ"}
            </button>
          </div>

          <div style={{ border: "1px solid #000", marginTop: 18 }}>
            <div style={{ display: "flex", borderBottom: "1px solid #000", padding: 12, fontWeight: 500 }}>
              <div style={{ width: 210 }}>WYSŁANO</div>
              <div style={{ width: 140 }}>SENT</div>
              <div style={{ width: 140 }}>OTWARTE</div>
              <div style={{ flex: 1 }}>TYTUŁ</div>
              <div style={{ width: 220 }}>AKCJE</div>
            </div>

            {sentHistory.map((c) => {
              const opened = opensByCampaign[c.id] ?? 0;
              const isOpen = !!expandedBody[c.id];
              return (
                <div key={c.id} style={{ borderBottom: "1px solid #E5E7EB" }}>
                  <div style={{ display: "flex", padding: 12, alignItems: "center" }}>
                    <div style={{ width: 210, fontSize: 12 }}>
                      {new Date(c.created_at).toLocaleString()}
                    </div>

                    <div style={{ width: 140, fontSize: 12 }}>{c.sent ?? 0}</div>
                    <div style={{ width: 140, fontSize: 12 }}>{opened}</div>

                    <div style={{ flex: 1, fontSize: 12 }}>
                      <Ellipsis title={c.title}>{c.title}</Ellipsis>
                    </div>

                    <div style={{ width: 220, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button
                        onClick={() =>
                          setExpandedBody((m) => ({ ...m, [c.id]: !m[c.id] }))
                        }
                        disabled={loading}
                        style={{
                          height: 36,
                          padding: "0 12px",
                          border: "1px solid #000",
                          background: "#fff",
                          cursor: "pointer",
                          letterSpacing: 2,
                        }}
                      >
                        {isOpen ? "ZWIŃ" : "PODGLĄD"}
                      </button>

                      <button
                        onClick={() => deleteCampaign(c.id)}
                        disabled={loading}
                        style={{
                          height: 36,
                          padding: "0 12px",
                          border: "1px solid #DC2626",
                          background: "#fff",
                          color: "#DC2626",
                          cursor: "pointer",
                          letterSpacing: 2,
                        }}
                      >
                        USUŃ
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ padding: "0 12px 12px 12px", fontSize: 12, color: "#111" }}>
                      <div style={{ letterSpacing: 2, fontSize: 11, marginBottom: 6 }}>
                        TREŚĆ:
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                        {c.body}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {sentHistory.length === 0 && (
              <div style={{ padding: 16, textAlign: "center" }}>
                Brak wysłanych powiadomień
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}