import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import type { PreviewBusiness, PreviewCustomer, PreviewCustomerRole } from "./types";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function dateLabel(value: string | null) {
  if (!value) return "No visits yet";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PreviewCustomersPage({ business, active = true }: { business: PreviewBusiness; active?: boolean }) {
  const [customers, setCustomers] = useState<PreviewCustomer[]>([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("preview_customers").select("*")
      .eq("business_slug", business.slug).order("joined_at", { ascending: false });
    if (error) setNotice(error.message);
    else {
      setCustomers((data ?? []) as PreviewCustomer[]);
      setNotice("");
    }
  }, [business.slug]);

  useEffect(() => { if (active) void load(); }, [active, load]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return customers;
    return customers.filter((customer) => [customer.name, customer.email, customer.short_code, customer.role]
      .some((field) => field.toLowerCase().includes(value)));
  }, [customers, query]);

  const totals = useMemo(() => ({
    visits: customers.reduce((sum, customer) => sum + customer.visits, 0),
    rewardReady: customers.filter((customer) => customer.points >= business.reward_threshold).length,
    pushEnabled: customers.filter((customer) => customer.push_enabled).length,
  }), [customers, business.reward_threshold]);

  async function updateRole(customer: PreviewCustomer, role: PreviewCustomerRole) {
    setBusyId(customer.id);
    setNotice("");
    try {
      const { error } = await supabase.rpc("preview_set_customer_role", {
        p_business_slug: business.slug,
        p_customer_id: customer.id,
        p_role: role,
      });
      if (error) throw error;
      await load();
      setNotice(`${customer.name}’s access was updated.`);
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteCustomer(customer: PreviewCustomer) {
    if (!confirm(`Delete ${customer.name}’s demo account?`)) return;
    setBusyId(customer.id);
    setNotice("");
    try {
      const { error } = await supabase.rpc("preview_delete_customer", {
        p_business_slug: business.slug,
        p_customer_id: customer.id,
      });
      if (error) throw error;
      await load();
      setNotice(`${customer.name}’s account was deleted.`);
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusyId(null);
    }
  }

  return <main className="dashboard-page customers-page" data-testid="customers-page">
    <div className="dashboard-page-head">
      <h1 className="dashboard-page-title">Users</h1>
    </div>

    <section className="dashboard-panel customers-search-card">
      <label className="dashboard-field"><span className="dashboard-label">SEARCH (name / email / code / role)</span><input className="dashboard-input customer-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Jamie or 123" /></label>
      <button className="dashboard-button dashboard-button--ghost customers-refresh" onClick={load}>REFRESH</button>
      {notice && <div className="dashboard-notice customers-notice">{notice}</div>}
    </section>

    <div className="dashboard-stat-grid customer-stats">
      <div className="dashboard-stat"><div className="dashboard-stat-label">Customers</div><div className="dashboard-stat-value">{customers.length}</div><div className="dashboard-stat-meta">Demo workspace</div></div>
      <div className="dashboard-stat"><div className="dashboard-stat-label">Visits</div><div className="dashboard-stat-value">{totals.visits}</div><div className="dashboard-stat-meta">Recorded check-ins</div></div>
      <div className="dashboard-stat"><div className="dashboard-stat-label">Rewards ready</div><div className="dashboard-stat-value">{totals.rewardReady}</div><div className="dashboard-stat-meta">At {business.reward_threshold}+ points</div></div>
      <div className="dashboard-stat"><div className="dashboard-stat-label">Push enabled</div><div className="dashboard-stat-value">{totals.pushEnabled}</div><div className="dashboard-stat-meta">Reachable customers</div></div>
    </div>

    <section className="customers-panel">
      <div className="dashboard-table-wrap customers-table-wrap">
        <table className="dashboard-table customer-table">
          <thead><tr><th>Customer</th><th>Code</th><th>Points</th><th>Visits</th><th>Last visit</th><th>Role</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((customer) => <tr key={customer.id}>
              <td><strong>{customer.name}</strong><br /><span className="dashboard-muted">{customer.email}</span></td>
              <td><strong>{customer.short_code}</strong></td>
              <td>{customer.points}</td>
              <td>{customer.visits}</td>
              <td>{dateLabel(customer.last_visit_at)}</td>
              <td>{customer.role}</td>
              <td><div className="dashboard-table-actions">
                {customer.role === "customer" && <button className="dashboard-button" disabled={busyId === customer.id} onClick={() => updateRole(customer, "staff")}>MAKE STAFF</button>}
                {customer.role === "staff" && <button className="dashboard-button dashboard-button--ghost" disabled={busyId === customer.id} onClick={() => updateRole(customer, "customer")}>REMOVE STAFF</button>}
                <button className="dashboard-button dashboard-button--danger" disabled={busyId === customer.id || customer.role === "manager"} onClick={() => deleteCustomer(customer)}>DELETE</button>
              </div></td>
            </tr>)}
            {!filtered.length && <tr><td colSpan={7}><div className="dashboard-empty">No customers match this search.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </main>;
}
