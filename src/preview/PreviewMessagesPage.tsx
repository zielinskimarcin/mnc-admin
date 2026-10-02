import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import type { PreviewBusiness } from "./types";

type Device = { expo_token: string; active_business_slug: string; device_name: string; approved: boolean; updated_at: string };
type PushLog = { id: string; title: string; body: string; accepted: number; recipients: number; created_at: string };
type PushJob = { id: string; title: string; body: string; status: string; send_at: string; next_run_at: string | null; repeat_cron: string | null; time_zone: string };
type View = "send" | "schedule" | "history";
type Repeat = "once" | "daily" | "weekly";

function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
function localDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function cronFor(repeat: Repeat, date: Date) {
  if (repeat === "once") return null;
  const minute = date.getMinutes();
  const hour = date.getHours();
  return repeat === "daily" ? `${minute} ${hour} * * *` : `${minute} ${hour} * * ${date.getDay()}`;
}
function repeatLabel(cron: string | null) {
  if (!cron) return "One time";
  return cron.endsWith(" *") ? "Every day" : "Every week";
}

export default function PreviewMessagesPage({ business, active = true }: { business: PreviewBusiness; active?: boolean }) {
  const [view, setView] = useState<View>("send");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [when, setWhen] = useState(() => localDateTime(new Date(Date.now() + 60 * 60 * 1000)));
  const [repeat, setRepeat] = useState<Repeat>("once");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [logs, setLogs] = useState<PushLog[]>([]);
  const [jobs, setJobs] = useState<PushJob[]>([]);
  const [opensByLog, setOpensByLog] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [devicesResult, logsResult, opensResult] = await Promise.all([
      supabase.from("preview_devices").select("expo_token,active_business_slug,device_name,approved,updated_at").eq("active_business_slug", business.slug).order("updated_at", { ascending: false }),
      supabase.from("preview_push_log").select("id,title,body,accepted,recipients,created_at").eq("business_slug", business.slug).order("created_at", { ascending: false }).limit(50),
      supabase.from("preview_push_opens").select("push_log_id").eq("business_slug", business.slug).limit(500),
    ]);
    const error = devicesResult.error ?? logsResult.error ?? opensResult.error;
    if (error) { setNotice(error.message); return; }
    setDevices((devicesResult.data ?? []) as Device[]);
    setLogs((logsResult.data ?? []) as PushLog[]);
    const nextOpens: Record<string, number> = {};
    for (const row of opensResult.data ?? []) nextOpens[row.push_log_id] = (nextOpens[row.push_log_id] ?? 0) + 1;
    setOpensByLog(nextOpens);
  }, [business.slug]);

  const loadJobs = useCallback(async () => {
    const { data, error } = await supabase.from("preview_push_jobs").select("id,title,body,status,send_at,next_run_at,repeat_cron,time_zone")
      .eq("business_slug", business.slug).eq("status", "scheduled").order("next_run_at").limit(50);
    if (error) setNotice(error.message);
    else setJobs((data ?? []) as PushJob[]);
  }, [business.slug]);

  useEffect(() => { if (active) void load(); }, [active, load]);
  useEffect(() => { if (active && view === "schedule") void loadJobs(); }, [active, view, loadJobs]);
  useEffect(() => { if (active && view === "history") void load(); }, [active, view, load]);

  const approvedDevices = useMemo(() => devices.filter((device) => device.approved), [devices]);
  const canSubmit = !busy && Boolean(title.trim()) && Boolean(body.trim()) && approvedDevices.length > 0;

  async function sendPush() {
    if (!canSubmit) return;
    setBusy(true); setNotice("");
    try {
      const { data, error } = await supabase.functions.invoke("preview_send_push", { body: { business_slug: business.slug, title: title.trim(), body: body.trim() } });
      if (error) {
        const context = error.context as Response | undefined;
        const detail = context?.json ? await context.json().catch(() => null) : null;
        throw new Error(typeof detail?.error === "string" ? detail.error : error.message);
      }
      setNotice(`Sent to ${data.accepted} connected device${data.accepted === 1 ? "" : "s"}.`);
      setTitle(""); setBody("");
      await load();
    } catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  }

  async function saveJob() {
    const date = new Date(when);
    if (!canSubmit || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) { setNotice("Choose a future date and complete the message."); return; }
    setBusy(true); setNotice("");
    const payload = {
      business_slug: business.slug,
      title: title.trim(), body: body.trim(),
      status: "scheduled", send_at: date.toISOString(), next_run_at: date.toISOString(),
      repeat_cron: cronFor(repeat, date),
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Denver",
      operator_id: (await supabase.auth.getUser()).data.user?.id,
      updated_at: new Date().toISOString(),
    };
    try {
      if (!payload.operator_id) throw new Error("Sign in before scheduling a message.");
      const { error } = editingId
        ? await supabase.from("preview_push_jobs").update(payload).eq("id", editingId).eq("business_slug", business.slug)
        : await supabase.from("preview_push_jobs").insert(payload);
      if (error) throw error;
      setNotice(editingId ? "Scheduled message updated." : "Message scheduled.");
      setEditingId(null); setTitle(""); setBody(""); setRepeat("once");
      await loadJobs();
    } catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  }

  function editJob(job: PushJob) {
    setEditingId(job.id); setTitle(job.title); setBody(job.body);
    setWhen(localDateTime(new Date(job.next_run_at ?? job.send_at)));
    setRepeat(!job.repeat_cron ? "once" : job.repeat_cron.endsWith(" *") ? "daily" : "weekly");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function cancelJob(job: PushJob) {
    if (!confirm(`Cancel “${job.title}”?`)) return;
    setBusy(true); setNotice("");
    const { error } = await supabase.from("preview_push_jobs").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", job.id).eq("business_slug", business.slug);
    setBusy(false);
    if (error) setNotice(error.message);
    else { setNotice("Scheduled message cancelled."); await loadJobs(); }
  }

  async function toggleDevice(device: Device) {
    setBusy(true); setNotice("");
    const { error } = await supabase.rpc("preview_set_device_approval", { p_token: device.expo_token, p_approved: !device.approved });
    if (error) setNotice(error.message);
    else { await load(); setNotice(device.approved ? "Test device disabled." : "Test device approved."); }
    setBusy(false);
  }

  return <main className="dashboard-page messages-page" data-testid="messages-page">
    <div className="dashboard-page-head"><h1 className="dashboard-page-title">Push</h1></div>
    <div className="dashboard-segments message-tabs" aria-label="Push sections">
      <button className={`dashboard-segment${view === "send" ? " is-active" : ""}`} onClick={() => { setView("send"); setNotice(""); }}>SEND NOW</button>
      <button className={`dashboard-segment${view === "schedule" ? " is-active" : ""}`} onClick={() => { setView("schedule"); setNotice(""); }}>SCHEDULE</button>
      <button className={`dashboard-segment${view === "history" ? " is-active" : ""}`} onClick={() => { setView("history"); setNotice(""); }}>HISTORY</button>
    </div>
    {notice && <div className="dashboard-notice message-notice" role="status">{notice}</div>}

    {(view === "send" || view === "schedule") && <section className="dashboard-panel message-composer">
      {view === "schedule" && <div className="message-section-label">{editingId ? "EDIT MESSAGE" : "NEW SCHEDULED MESSAGE"}</div>}
      <label className="dashboard-field"><span className="dashboard-label">AUDIENCE</span>
        <select className="dashboard-select message-audience" value="all" disabled><option value="all">All connected customers</option></select>
      </label>
      {view === "schedule" && <>
        <label className="dashboard-field"><span className="dashboard-label">DATE & TIME</span><input className="dashboard-input" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} /></label>
        <label className="dashboard-field"><span className="dashboard-label">REPEAT</span><select className="dashboard-select" value={repeat} onChange={(event) => setRepeat(event.target.value as Repeat)}><option value="once">One time</option><option value="daily">Every day</option><option value="weekly">Every week</option></select></label>
      </>}
      <label className="dashboard-field"><span className="dashboard-label">TITLE</span><input className="dashboard-input" maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A new special is here" /></label>
      <label className="dashboard-field"><span className="dashboard-label">MESSAGE</span><textarea className="dashboard-textarea message-body" maxLength={240} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Stop by this week and see what’s new." /></label>
      <button className="dashboard-button message-submit" disabled={!canSubmit} onClick={view === "send" ? sendPush : saveJob}>{busy ? "PLEASE WAIT…" : view === "send" ? "SEND PUSH" : editingId ? "SAVE CHANGES" : "SCHEDULE PUSH"}</button>
      {view === "schedule" && editingId && <button className="dashboard-button dashboard-button--ghost message-cancel-edit" onClick={() => { setEditingId(null); setTitle(""); setBody(""); setRepeat("once"); }}>CANCEL EDIT</button>}
    </section>}

    {view === "schedule" && <section className="message-scheduled">
      <div className="message-list-head"><h2>UPCOMING MESSAGES</h2><button className="dashboard-button dashboard-button--ghost" onClick={loadJobs}>REFRESH</button></div>
      {jobs.length ? jobs.map((job) => <article className="dashboard-panel message-job" key={job.id}>
        <div><strong>{job.title}</strong><p>{job.body}</p><small>{new Date(job.next_run_at ?? job.send_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · {repeatLabel(job.repeat_cron)}</small></div>
        <div className="message-job-actions"><button className="dashboard-button dashboard-button--ghost" disabled={busy} onClick={() => editJob(job)}>EDIT</button><button className="dashboard-button dashboard-button--ghost" disabled={busy} onClick={() => cancelJob(job)}>CANCEL</button></div>
      </article>) : <div className="dashboard-panel dashboard-empty">No messages scheduled yet.</div>}
    </section>}

    {view === "history" && <section className="message-history">
      <div className="message-list-head"><h2>SENT MESSAGES</h2><button className="dashboard-button dashboard-button--ghost" onClick={load}>REFRESH</button></div>
      <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Sent</th><th>Message</th><th>Accepted</th><th>Opened</th></tr></thead><tbody>
        {logs.map((log) => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td><td><strong>{log.title}</strong><br /><span className="dashboard-muted">{log.body}</span></td><td>{log.accepted}/{log.recipients}</td><td>{opensByLog[log.id] ?? 0}</td></tr>)}
        {!logs.length && <tr><td colSpan={4}><div className="dashboard-empty">No messages sent yet.</div></td></tr>}
      </tbody></table></div>
    </section>}

    <details className="message-devices">
      <summary>CONNECTED TEST DEVICES ({approvedDevices.length})</summary>
      <p>Only approved preview devices receive these messages.</p>
      {devices.length ? devices.map((device) => <div className="message-device-row" key={device.expo_token}><div><strong>{device.device_name}</strong><span>{new Date(device.updated_at).toLocaleString("en-US")}</span></div><button className={`dashboard-button ${device.approved ? "dashboard-button--ghost" : ""}`} disabled={busy} onClick={() => toggleDevice(device)}>{device.approved ? "DISABLE" : "APPROVE"}</button></div>) : <div className="dashboard-empty">No test device connected.</div>}
    </details>
  </main>;
}
