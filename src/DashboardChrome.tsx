import type { ReactNode } from "react";
import "./dashboard.css";

type Tab = { key: string; label: string; show?: boolean };

export default function DashboardChrome({ title, role, tabs, activeTab, onTab, onSignOut, extra, brandControl, children, hideRole = false, signOutLabel = "WYLOGUJ" }: {
  title: string;
  subtitle?: string;
  role: string;
  tabs: Tab[];
  activeTab: string;
  onTab: (tab: string) => void;
  onSignOut?: () => void;
  extra?: ReactNode;
  brandControl?: ReactNode;
  children: ReactNode;
  hideRole?: boolean;
  signOutLabel?: string;
}) {
  const visibleTabs = tabs.filter((tab) => tab.show !== false);

  return <div className="dashboard-shell">
    <header className="dashboard-topbar">
      <div className="dashboard-brand-row">
        {brandControl ?? <div className="dashboard-brand">{title}</div>}
        {!hideRole && <div className="dashboard-role-badge">{role.toUpperCase()}</div>}
      </div>
      <div className="dashboard-topbar-actions">
        {extra}
        {onSignOut && <button className="dashboard-small-button" onClick={onSignOut}>{signOutLabel}</button>}
      </div>
    </header>

    <nav className="dashboard-tabs" aria-label="Dashboard navigation" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}>
      {visibleTabs.map((tab) => <button
        key={tab.key}
        className={`dashboard-tab${activeTab === tab.key ? " is-active" : ""}`}
        onClick={() => onTab(tab.key)}
        aria-current={activeTab === tab.key ? "page" : undefined}
      >{tab.label}</button>)}
    </nav>

    {children}
  </div>;
}
