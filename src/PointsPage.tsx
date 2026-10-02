import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

type LoyaltyEvent = {
  id: string;
  profile_id: string;
  staff_id: string | null;
  delta: number;
  points_after: number;
  reason: string;
  created_at: string;
};

type ProfileSummary = {
  id: string;
  email: string | null;
  short_code: string | null;
};

function formatEventReason(reason: string) {
  return reason === "reward_redemption" ? "Reward" : "Points";
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function PointsPage({ previewBusiness, active = true }: {
  previewBusiness?: { slug: string; reward_threshold: number };
  active?: boolean;
} = {}) {
  const [code, setCode] = useState(previewBusiness ? "123" : "");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<LoyaltyEvent[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileSummary>>({});
  const [eventsMessage, setEventsMessage] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setEventsMessage(null);
    if (previewBusiness) {
      const [eventsResult, customersResult] = await Promise.all([
        supabase.from("preview_point_events")
          .select("id,customer_id,delta,points_after,operator_id,created_at")
          .eq("business_slug", previewBusiness.slug)
          .order("created_at", { ascending: false }).limit(50),
        supabase.from("preview_customers")
          .select("id,email,short_code").eq("business_slug", previewBusiness.slug),
      ]);
      const firstError = eventsResult.error ?? customersResult.error;
      if (firstError) {
        setEventsMessage(firstError.message);
        return;
      }
      const customerRows = (customersResult.data ?? []) as ProfileSummary[];
      setProfilesById(Object.fromEntries(customerRows.map((customer) => [customer.id, customer])));
      setEvents((eventsResult.data ?? []).map((event) => ({
        id: event.id,
        profile_id: event.customer_id ?? "preview-member",
        staff_id: event.operator_id,
        delta: event.delta,
        points_after: event.points_after,
        reason: event.delta <= -previewBusiness.reward_threshold ? "reward_redemption" : "point_adjustment",
        created_at: event.created_at,
      })));
      return;
    }

    const { data, error } = await supabase.from("loyalty_events")
      .select("id, profile_id, staff_id, delta, points_after, reason, created_at")
      .order("created_at", { ascending: false }).limit(50);
    if (error) {
      setEventsMessage(error.message);
      return;
    }
    const nextEvents = (data ?? []) as LoyaltyEvent[];
    setEvents(nextEvents);
    const ids = Array.from(new Set(nextEvents.flatMap((event) => [event.profile_id, event.staff_id]).filter(Boolean) as string[]));
    if (!ids.length) {
      setProfilesById({});
      return;
    }
    const { data: profiles } = await supabase.from("profiles")
      .select("id,email,short_code").in("id", ids);
    setProfilesById(Object.fromEntries(((profiles ?? []) as ProfileSummary[]).map((profile) => [profile.id, profile])));
  }, [previewBusiness]);

  useEffect(() => {
    setCode(previewBusiness ? "123" : "");
    setNotice(null);
  }, [previewBusiness]);
  useEffect(() => { if (active) void loadEvents(); }, [active, loadEvents]);

  function validCode() {
    const value = code.trim();
    if (!/^\d{3}$/.test(value)) {
      setNotice("Enter the customer’s three-digit code.");
      return null;
    }
    return value;
  }

  async function adjustPoint(delta: 1 | -1) {
    const value = validCode();
    if (!value) return;
    setLoading(true);
    setNotice(null);
    try {
      if (previewBusiness) {
        const { data, error } = await supabase.rpc("preview_adjust_points_by_code", {
          p_business_slug: previewBusiness.slug,
          p_short_code: value,
          p_delta: delta,
        });
        if (error) throw error;
        setNotice(delta > 0 ? `Point added. New balance: ${data}` : `Point removed. New balance: ${data}`);
      } else {
        const { data, error } = await supabase.rpc("staff_adjust_points_by_code", {
          p_short_code: value,
          p_delta: delta,
        }).single();
        if (error || !data) throw error ?? new Error("Customer not found");
        const points = (data as { points: number }).points ?? 0;
        setNotice(delta > 0 ? `Point added. New balance: ${points}` : `Point removed. New balance: ${points}`);
        setCode("");
      }
      await loadEvents();
    } catch (error) {
      setNotice(message(error));
    } finally {
      setLoading(false);
    }
  }

  async function redeemReward() {
    const value = validCode();
    if (!value) return;
    if (!confirm(`Redeem the reward and subtract ${previewBusiness?.reward_threshold ?? 10} points?`)) return;
    setLoading(true);
    setNotice(null);
    try {
      if (previewBusiness) {
        const { data, error } = await supabase.rpc("preview_redeem_reward_by_code", {
          p_business_slug: previewBusiness.slug,
          p_short_code: value,
        });
        if (error) throw error;
        setNotice(`Reward redeemed. New balance: ${data}`);
      } else {
        const { data, error } = await supabase.rpc("staff_redeem_reward_by_code", { p_short_code: value }).single();
        if (error || !data) throw error ?? new Error("Could not redeem the reward");
        setNotice(`Reward redeemed. New balance: ${(data as { points: number }).points ?? 0}`);
        setCode("");
      }
      await loadEvents();
    } catch (error) {
      setNotice(message(error));
    } finally {
      setLoading(false);
    }
  }

  async function clearEvents() {
    if (previewBusiness || !confirm("Clear the entire points history?")) return;
    setLoading(true);
    const { error } = await supabase.rpc("admin_clear_loyalty_events");
    setLoading(false);
    if (error) setEventsMessage(error.message);
    else {
      setEvents([]);
      setProfilesById({});
      setEventsMessage("Points history cleared.");
    }
  }

  return <main className="dashboard-page loyalty-page" data-testid="loyalty-page">
    <div className="dashboard-page-head">
      <h1 className="dashboard-page-title">Points</h1>
    </div>

    <section className="dashboard-panel loyalty-action-panel">
      <label className="dashboard-field loyalty-code-field">
        <span className="dashboard-label">ENTER CODE (3 DIGITS)</span>
        <input className="dashboard-input loyalty-code-input" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="123" inputMode="numeric" />
      </label>
      <button className="dashboard-button loyalty-primary" onClick={() => adjustPoint(1)} disabled={loading}>{loading ? "UPDATING…" : "ADD POINT"}</button>
      <div className="loyalty-secondary-actions">
        <button className="dashboard-button dashboard-button--ghost" onClick={() => adjustPoint(-1)} disabled={loading}>REMOVE POINT</button>
        <button className="dashboard-button dashboard-button--ghost" onClick={redeemReward} disabled={loading}>REDEEM REWARD (-{previewBusiness?.reward_threshold ?? 10})</button>
      </div>
      {notice && <div className="dashboard-notice loyalty-notice">{notice}</div>}
    </section>

    <section className="dashboard-panel loyalty-history-panel">
      <div className="dashboard-panel-head">
        <h2 className="dashboard-panel-title">Recent activity</h2>
        <div className="dashboard-actions">
          <button className="dashboard-button dashboard-button--ghost" onClick={loadEvents} disabled={loading}>REFRESH</button>
          {!previewBusiness && <button className="dashboard-button dashboard-button--ghost" onClick={clearEvents} disabled={loading}>CLEAR</button>}
        </div>
      </div>
      {eventsMessage && <div className="dashboard-notice">{eventsMessage}</div>}
      <div className="dashboard-table-wrap loyalty-table-wrap">
        <table className="dashboard-table">
          <thead><tr><th>Date</th><th>Customer</th><th>Activity</th><th>Balance</th></tr></thead>
          <tbody>
            {events.map((event) => {
              const profile = profilesById[event.profile_id];
              return <tr key={event.id}>
                <td>{new Date(event.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td><strong>{profile?.short_code ?? "123"}</strong><br /><span className="dashboard-muted">{profile?.email ?? "Demo customer"}</span></td>
                <td>{formatEventReason(event.reason)} <strong>{event.delta > 0 ? `+${event.delta}` : event.delta}</strong></td>
                <td><strong>{event.points_after}</strong> points</td>
              </tr>;
            })}
            {!events.length && !eventsMessage && <tr><td colSpan={4}><div className="dashboard-empty">No loyalty activity yet.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </main>;
}
