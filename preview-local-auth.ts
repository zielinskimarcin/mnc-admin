import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import type { Plugin } from "vite";

const previewRef = "sgjpbknrmlacheilutej";

export function previewLocalAuth(url: string): Plugin {
  if (new URL(url).hostname !== `${previewRef}.supabase.co`) {
    throw new Error("Local preview access is restricted to the App Preview Supabase project");
  }

  let serviceKey: string | undefined;
  return {
    name: "preview-local-auth",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__preview/auto-session", async (request, response) => {
        response.setHeader("Cache-Control", "no-store");
        const host = request.headers.host;
        const origin = request.headers.origin;
        const remote = request.socket.remoteAddress;
        if (request.method !== "POST" || !host || !/^127\.0\.0\.1:\d+$/.test(host) ||
          origin !== `http://${host}` || (remote !== "127.0.0.1" && remote !== "::1") ||
          request.headers["x-app-preview-local"] !== "1") {
          response.writeHead(403).end();
          return;
        }

        try {
          if (!serviceKey) {
            const cli = process.env.APP_PREVIEW_SUPABASE_CLI || "supabase";
            const output = execFileSync(cli, ["projects", "api-keys", "--project-ref", previewRef, "--reveal", "--output-format", "json"], {
              encoding: "utf8",
              timeout: 60000,
              maxBuffer: 1024 * 1024,
              stdio: ["ignore", "pipe", "pipe"],
              cwd: "/private/tmp",
              env: process.env,
            });
            const parsed = JSON.parse(output) as Array<{ name?: string; api_key?: string }> | { keys?: Array<{ name?: string; api_key?: string }> };
            const keys = Array.isArray(parsed) ? parsed : parsed.keys;
            serviceKey = keys?.find((key) => key.name === "service_role")?.api_key;
            if (!serviceKey) throw new Error("Preview service key unavailable from Supabase CLI");
          }

          const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
          const { data: operators, error: operatorsError } = await admin.from("preview_operators").select("user_id").limit(2);
          if (operatorsError) throw operatorsError;
          if (operators?.length !== 1) throw new Error("Expected exactly one preview operator");
          const operatorId = operators[0].user_id as string;
          const { data: operator, error: userError } = await admin.auth.admin.getUserById(operatorId);
          if (userError || !operator.user?.email) throw userError ?? new Error("Preview operator has no email");
          const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: operator.user.email });
          if (linkError || !link.properties?.hashed_token || link.user?.id !== operatorId) {
            throw linkError ?? new Error("Could not create the operator session");
          }
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ token_hash: link.properties.hashed_token }));
        } catch {
          response.writeHead(503, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error: "Automatic local access failed. Check that Supabase CLI is still signed in, then reload." }));
        }
      });
    },
  };
}
