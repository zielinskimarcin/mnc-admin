import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

serve(async (req) => {
  // 🔥 Najważniejsze — preflight zawsze OK
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing env vars" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const service = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 🔒 Sprawdzenie admina
    const { data: profile } = await service
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: corsHeaders }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "GET" && action === "list") {
      const { data: users } = await service.auth.admin.listUsers({
        perPage: 200,
        page: 1,
      });

      return new Response(
        JSON.stringify({ users: users.users }),
        { headers: corsHeaders }
      );
    }

    if (req.method === "POST" && action === "set_role") {
      const { user_id, role } = await req.json();

      await service
        .from("profiles")
        .update({ role })
        .eq("id", user_id);

      return new Response(JSON.stringify({ ok: true }), {
        headers: corsHeaders,
      });
    }

    if (req.method === "POST" && action === "delete_user") {
      const { user_id } = await req.json();

      const { data: target } = await service
        .from("profiles")
        .select("role")
        .eq("id", user_id)
        .single();

      if (target?.role === "admin") {
        return new Response(
          JSON.stringify({ error: "Nie można usunąć administratora." }),
          { status: 400, headers: corsHeaders }
        );
      }

      await service.from("profiles").delete().eq("id", user_id);
      await service.auth.admin.deleteUser(user_id);

      return new Response(JSON.stringify({ ok: true }), {
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});