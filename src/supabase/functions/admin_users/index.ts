// supabase/functions/admin_users/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Role = "admin" | "staff" | "user";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
  });
}

async function requireAdmin(service: any, userId: string) {
  const { data, error } = await service
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error) return { ok: false, reason: "profile_read_error", error };
  if (!data?.role) return { ok: false, reason: "no_role" };
  if (data.role !== "admin") return { ok: false, reason: "not_admin" };
  return { ok: true as const };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) return json({ error: "Missing authorization header" }, 401);

  // client “user” do sprawdzenia kto dzwoni
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: u, error: uErr } = await userClient.auth.getUser();
  if (uErr || !u?.user) return json({ error: "Invalid session" }, 401);

  const callerId = u.user.id;

  // client “service” do admin operacji
  const service = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // tylko ADMIN ma dostęp do tej funkcji
  const adminCheck = await requireAdmin(service, callerId);
  if (!adminCheck.ok) return json({ error: "Forbidden" }, 403);

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop() || ""; // admin_users
  const action = url.searchParams.get("action") || "";

  // -------- LIST USERS --------
  if (req.method === "GET" && action === "list") {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    // 1) bierzemy auth users (email + created_at)
    const { data: usersRes, error: listErr } = await service.auth.admin.listUsers({
      perPage: 200,
      page: 1,
    });
    if (listErr) return json({ error: listErr.message }, 500);

    const authUsers = usersRes.users.map((x) => ({
      id: x.id,
      email: x.email ?? null,
      created_at: x.created_at ?? null,
      last_sign_in_at: (x as any).last_sign_in_at ?? null,
    }));

    // 2) dołączamy profile (role, short_code, points)
    const ids = authUsers.map((x) => x.id);
    const { data: profs, error: profErr } = await service
      .from("profiles")
      .select("id, role, short_code, points")
      .in("id", ids);

    if (profErr) return json({ error: profErr.message }, 500);

    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));

    let out = authUsers.map((u1) => {
      const p = map.get(u1.id);
      return {
        id: u1.id,
        email: u1.email,
        created_at: u1.created_at,
        last_sign_in_at: u1.last_sign_in_at,
        role: (p?.role ?? "user") as Role,
        short_code: p?.short_code ?? null,
        points: p?.points ?? 0,
      };
    });

    if (q) {
      out = out.filter((x) => {
        const a = (x.email ?? "").toLowerCase();
        const b = (x.short_code ?? "").toLowerCase();
        return a.includes(q) || b.includes(q) || x.id.toLowerCase().includes(q);
      });
    }

    return json({ users: out });
  }

  // body JSON
  let body: any = {};
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  // -------- SET ROLE --------
  if (req.method === "POST" && action === "set_role") {
    const user_id = String(body.user_id || "");
    const role = String(body.role || "") as Role;

    if (!user_id) return json({ error: "Missing user_id" }, 400);
    if (!["admin", "staff", "user"].includes(role)) return json({ error: "Bad role" }, 400);

    const { error } = await service.from("profiles").update({ role }).eq("id", user_id);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  }

  // -------- SEND RESET PASSWORD EMAIL --------
  if (req.method === "POST" && action === "reset_password") {
    const email = String(body.email || "");
    if (!email) return json({ error: "Missing email" }, 400);

    // Supabase: wysyła mail resetujący (musi mieć skonfigurowany Email provider + redirect URL)
    const { error } = await service.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // -------- DELETE USER (auth + profile) --------
  if (req.method === "POST" && action === "delete_user") {
    const user_id = String(body.user_id || "");
    if (!user_id) return json({ error: "Missing user_id" }, 400);

    // usuń profil
    await service.from("profiles").delete().eq("id", user_id);
    // usuń auth user
    const { error } = await service.auth.admin.deleteUser(user_id);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
});