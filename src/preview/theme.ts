import type { CSSProperties } from "react";
import type { PreviewBusiness } from "./types";

type DashboardVariables = CSSProperties & Record<`--${string}`, string>;

export function dashboardTheme(business: PreviewBusiness | null): DashboardVariables {
  const preset = business?.slug === "mnc" ? "mnc" : business?.design_preset ?? "mnc";
  if (preset === "normal") {
    return {
      "--dashboard-font-body": '"Dashboard Poppins",ui-sans-serif,system-ui,sans-serif',
      "--dashboard-font-display": '"Dashboard Poppins",ui-sans-serif,system-ui,sans-serif',
      "--dashboard-radius-card": "10px",
      "--dashboard-radius-control": "7px",
    };
  }
  if (preset === "chatchat") {
    return {
      "--dashboard-font-body": '"Dashboard Wix Text",ui-sans-serif,system-ui,sans-serif',
      "--dashboard-font-display": '"Dashboard Wix Text",ui-sans-serif,system-ui,sans-serif',
      "--dashboard-radius-card": "22px",
      "--dashboard-radius-control": "16px",
    };
  }
  return {
    "--dashboard-font-body": '"Dashboard Inter",ui-sans-serif,system-ui,sans-serif',
    "--dashboard-font-display": '"Dashboard Inter",ui-sans-serif,system-ui,sans-serif',
    "--dashboard-radius-card": "0px",
    "--dashboard-radius-control": "0px",
  };
}
