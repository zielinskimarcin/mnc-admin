import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import { previewLocalAuth } from "./preview-local-auth";

function readDashboardConfig(slug: string) {
  const configUrl = new URL(`./clients/${slug}/dashboard.config.json`, import.meta.url);

  if (!fs.existsSync(configUrl)) {
    throw new Error(`Unknown dashboard client "${slug}"`);
  }

  return JSON.parse(fs.readFileSync(configUrl, "utf8")) as { basePath: string };
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (mode === "preview") {
    const productionEnv = new URL("./.env", import.meta.url);
    const productionUrl = fs.existsSync(productionEnv)
      ? fs.readFileSync(productionEnv, "utf8").match(/^VITE_SUPABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "")
      : undefined;
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
      throw new Error("Preview dashboard needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from the separate preview project");
    }
    if (productionUrl && env.VITE_SUPABASE_URL === productionUrl) {
      throw new Error("Preview dashboard must not use the production MNC Supabase project");
    }
    return {
      plugins: command === "serve" ? [react(), previewLocalAuth(env.VITE_SUPABASE_URL)] : [react()],
      base: command === "serve" ? "/" : env.VITE_ADMIN_BASE_PATH || "/admin/",
      server: { host: "127.0.0.1", strictPort: true },
    };
  }
  const client = readDashboardConfig(env.VITE_CLIENT_SLUG || "mnc");

  return {
    plugins: [react()],
    base: env.VITE_ADMIN_BASE_PATH || client.basePath,
  };
});
