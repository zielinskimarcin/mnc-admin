import { useState } from "react";
import MenuPage from "./MenuPage";
import PointsPage from "./PointsPage";

export default function App() {
  const [tab, setTab] = useState<"menu" | "points">("menu");

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #000" }}>
        <button style={tab === "menu" ? on : off} onClick={() => setTab("menu")}>MENU</button>
        <button style={tab === "points" ? on : off} onClick={() => setTab("points")}>PUNKTY</button>
      </div>

      {tab === "menu" ? <MenuPage /> : <PointsPage />}
    </div>
  );
}

const on = { height: 54, background: "#000", color: "#fff", border: "none", letterSpacing: 2 };
const off = { height: 54, background: "#fff", color: "#000", border: "none", letterSpacing: 2 };