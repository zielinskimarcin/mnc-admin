import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

const rootModule = import.meta.env.MODE === "preview"
  ? import("./preview/PreviewOperatorApp.tsx")
  : import("./App.tsx");

rootModule.then(({ default: Root }) => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode><Root /></React.StrictMode>
  );
});
