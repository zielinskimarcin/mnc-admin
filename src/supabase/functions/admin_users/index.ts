import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "Invalid session" }, 401);

  const service = createClient(SUPABASE_URL, SERVICE_ROLE);

  // sprawdź czy caller jest adminem
  const { data: callerProfile } = await service
    .from("profiles")
    .select("role")
    .eq("id", u.user.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return json({ error: "Forbidden" }, 403);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (req.method === "POST" && action === "reset_password") {
    const { email } = await req.json();

    const { error } = await service.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  }

  if (req.method === "POST" && action === "delete_user") {
    const { user_id } = await req.json();

    // usuń profil
    await service.from("profiles").delete().eq("id", user_id);

    // usuń auth user
    const { error } = await service.auth.admin.deleteUser(user_id);

    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  }

  return json({ error: "Invalid request" }, 400);
});