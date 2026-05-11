import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

function readDashboardConfig(slug: string) {
  const configUrl = new URL(`./clients/${slug}/dashboard.config.json`, import.meta.url);

  if (!fs.existsSync(configUrl)) {
    throw new Error(`Unknown dashboard client "${slug}"`);
  }

  return JSON.parse(fs.readFileSync(configUrl, "utf8")) as { basePath: string };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const client = readDashboardConfig(env.VITE_CLIENT_SLUG || "mnc");

  return {
    plugins: [react()],
    base: env.VITE_ADMIN_BASE_PATH || client.basePath,
  };
});
