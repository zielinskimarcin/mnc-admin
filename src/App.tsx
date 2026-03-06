import { useState } from "react";
import MenuPage from "./MenuPage";
import PointsPage from "./PointsPage";
import PushPage from "./PushPage";

export default function App() {
  const [tab, setTab] = useState<"menu" | "points" | "push">("menu");

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          borderBottom: "1px solid #000",
        }}
      >
        <button style={tab === "menu" ? on : off} onClick={() => setTab("menu")}>
          MENU
        </button>
        <button style={tab === "points" ? on : off} onClick={() => setTab("points")}>
          PUNKTY
        </button>
        <button style={tab === "push" ? on : off} onClick={() => setTab("push")}>
          PUSH
        </button>
      </div>

      {tab === "menu" && <MenuPage />}
      {tab === "points" && <PointsPage />}
      {tab === "push" && <PushPage />}
    </div>
  );
}

const on = {
  height: 54,
  background: "#000",
  color: "#fff",
  border: "none",
  letterSpacing: 2,
};

const off = {
  height: 54,
  background: "#fff",
  color: "#000",
  border: "none",
  letterSpacing: 2,
};