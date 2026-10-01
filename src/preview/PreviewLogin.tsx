import { useState, type FormEvent } from "react";
import { supabase } from "../supabase";

const demoOperatorEmail = "demo-operator@smaklo.com";

export default function PreviewLogin() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setNotice("");
    const { error } = await supabase.auth.signInWithPassword({ email: demoOperatorEmail, password });
    setBusy(false);
    if (error) setNotice("Incorrect password. Try again.");
  }

  return <main className="preview-login-shell">
    <section className="preview-login-card">
      <div className="dashboard-page-kicker">PRIVATE WORKSPACE</div>
      <h1>Restaurant dashboard</h1>
      <p>Enter the dashboard password.</p>
      <form onSubmit={(event) => void signIn(event)}>
        <label className="dashboard-field">
          <span className="dashboard-label">Password</span>
          <input className="dashboard-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <button className="dashboard-button dashboard-button--wide" type="submit" disabled={busy || !password}>{busy ? "SIGNING IN…" : "SIGN IN"}</button>
      </form>
      {notice && <div className="dashboard-notice">{notice}</div>}
    </section>
  </main>;
}
