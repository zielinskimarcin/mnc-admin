import { useState } from "react";
import { supabase } from "../supabase";

export default function PreviewLogin() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function requestLink() {
    if (!email.trim()) return;
    setBusy(true);
    setNotice("");
    // Vercel serves the dashboard at /admin (without a trailing slash).
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";
    const redirectTo = `${window.location.origin}${basePath}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    });
    setBusy(false);
    setNotice(error ? error.message : "Check your email for a secure sign-in link.");
  }

  return <main className="preview-login-shell">
    <section className="preview-login-card">
      <div className="dashboard-page-kicker">PRIVATE WORKSPACE</div>
      <h1>Restaurant dashboard</h1>
      <p>Use the operator email to receive a secure sign-in link.</p>
      <label className="dashboard-field">
        <span className="dashboard-label">Email</span>
        <input className="dashboard-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void requestLink(); }} />
      </label>
      <button className="dashboard-button dashboard-button--wide" disabled={busy || !email.trim()} onClick={requestLink}>{busy ? "SENDING…" : "SEND SIGN-IN LINK"}</button>
      {notice && <div className="dashboard-notice">{notice}</div>}
    </section>
  </main>;
}
