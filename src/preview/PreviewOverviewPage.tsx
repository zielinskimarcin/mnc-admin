import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import type { PreviewBusiness } from "./types";

type Snapshot = {
  customers: number;
  visits: number;
  menuItems: number;
  messages: number;
  opens: number;
  recentPoints: number;
};

const emptySnapshot: Snapshot = { customers: 0, visits: 0, menuItems: 0, messages: 0, opens: 0, recentPoints: 0 };

export default function PreviewOverviewPage({ business, onNavigate }: {
  business: PreviewBusiness;
  onNavigate: (tab: "menu" | "points" | "push" | "customers") => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [customersResult, menuResult, messagesResult, opensResult, eventsResult] = await Promise.all([
      supabase.from("preview_customers").select("visits").eq("business_slug", business.slug),
      supabase.from("preview_menu_items").select("id", { count: "exact", head: true }).eq("business_slug", business.slug),
      supabase.from("preview_push_log").select("id", { count: "exact", head: true }).eq("business_slug", business.slug),
      supabase.from("preview_push_opens").select("id", { count: "exact", head: true }).eq("business_slug", business.slug),
      supabase.from("preview_point_events").select("delta").eq("business_slug", business.slug).gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);
    const firstError = customersResult.error ?? menuResult.error ?? messagesResult.error ?? opensResult.error ?? eventsResult.error;
    if (firstError) {
      setNotice(firstError.message);
      return;
    }
    const customers = customersResult.data ?? [];
    setSnapshot({
      customers: customers.length,
      visits: customers.reduce((sum, customer) => sum + Number(customer.visits ?? 0), 0),
      menuItems: menuResult.count ?? 0,
      messages: messagesResult.count ?? 0,
      opens: opensResult.count ?? 0,
      recentPoints: (eventsResult.data ?? []).filter((event) => Number(event.delta) > 0).reduce((sum, event) => sum + Number(event.delta), 0),
    });
    setNotice("");
  }, [business.slug]);

  useEffect(() => { void load(); }, [load]);

  const openRate = snapshot.messages > 0 ? Math.round((snapshot.opens / snapshot.messages) * 100) : 0;

  return <main className="dashboard-page overview-page" data-testid="overview-page">
    <div className="dashboard-page-head">
      <div>
        <div className="dashboard-page-kicker">{business.status === "ready" ? "READY WORKSPACE" : "PREVIEW WORKSPACE"}</div>
        <h1 className="dashboard-page-title">Good to see you.</h1>
        <p className="dashboard-page-copy">A focused view of the menu, loyalty program, customers, and direct messages for {business.display_name}.</p>
      </div>
      <button className="dashboard-button dashboard-button--ghost" onClick={load}>REFRESH DATA</button>
    </div>

    {notice && <div className="dashboard-notice overview-notice">{notice}</div>}

    <div className="dashboard-stat-grid">
      <div className="dashboard-stat"><div className="dashboard-stat-label">Customers</div><div className="dashboard-stat-value">{snapshot.customers}</div><div className="dashboard-stat-meta">In this workspace</div></div>
      <div className="dashboard-stat"><div className="dashboard-stat-label">Recorded visits</div><div className="dashboard-stat-value">{snapshot.visits}</div><div className="dashboard-stat-meta">Across loyalty members</div></div>
      <div className="dashboard-stat"><div className="dashboard-stat-label">Points added</div><div className="dashboard-stat-value">{snapshot.recentPoints}</div><div className="dashboard-stat-meta">Last 30 days</div></div>
      <div className="dashboard-stat"><div className="dashboard-stat-label">Message opens</div><div className="dashboard-stat-value">{openRate}%</div><div className="dashboard-stat-meta">{snapshot.opens} tracked opens</div></div>
    </div>

    <section className="overview-grid">
      <article className="dashboard-panel overview-feature">
        <div className="dashboard-page-kicker">MENU</div>
        <h2 className="dashboard-panel-title">{snapshot.menuItems} items stay in sync</h2>
        <p>Update a name, description, section, or price from one structured editor.</p>
        <button className="dashboard-button dashboard-button--ghost" onClick={() => onNavigate("menu")}>MANAGE MENU</button>
      </article>
      <article className="dashboard-panel overview-feature">
        <div className="dashboard-page-kicker">LOYALTY</div>
        <h2 className="dashboard-panel-title">One code, immediate update</h2>
        <p>Enter the customer’s code and their point balance updates in the app.</p>
        <button className="dashboard-button dashboard-button--ghost" onClick={() => onNavigate("points")}>OPEN LOYALTY</button>
      </article>
      <article className="dashboard-panel overview-feature">
        <div className="dashboard-page-kicker">MESSAGES</div>
        <h2 className="dashboard-panel-title">Reach customers directly</h2>
        <p>Send an update to approved devices and measure real opens.</p>
        <button className="dashboard-button dashboard-button--ghost" onClick={() => onNavigate("push")}>SEND UPDATE</button>
      </article>
      <article className="dashboard-panel overview-feature">
        <div className="dashboard-page-kicker">CUSTOMERS</div>
        <h2 className="dashboard-panel-title">Know your regulars</h2>
        <p>See visit history, points, notification access, and staff roles.</p>
        <button className="dashboard-button dashboard-button--ghost" onClick={() => onNavigate("customers")}>VIEW CUSTOMERS</button>
      </article>
    </section>
  </main>;
}
