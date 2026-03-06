import { useState } from "react";

export default function PushPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function sendPush() {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch(
        "https://wqkzxoxprbbbphtlnxzg.supabase.co/functions/v1/send_push",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            body,
            data: { screen: "MENU" },
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setMsg("Błąd: " + (data.error || "Nieznany"));
      } else {
        setMsg("Push wysłany 🚀");
        setTitle("");
        setBody("");
      }
    } catch {
      setMsg("Błąd połączenia");
    }

    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: 24 }}>
      <h2>WYŚLIJ PUSH</h2>

      <input
        placeholder="Tytuł"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", padding: 12, marginBottom: 16 }}
      />

      <textarea
        placeholder="Treść"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        style={{ width: "100%", padding: 12, marginBottom: 16 }}
        rows={4}
      />

      <button
        onClick={sendPush}
        disabled={loading}
        style={{
          width: "100%",
          height: 50,
          background: "#000",
          color: "#fff",
          border: "none",
          letterSpacing: 2,
          cursor: "pointer",
        }}
      >
        {loading ? "Wysyłanie..." : "WYŚLIJ PUSH"}
      </button>

      {msg && <p style={{ marginTop: 16 }}>{msg}</p>}
    </div>
  );
}