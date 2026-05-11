import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { tenant } from "./src/tenant";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    base: env.VITE_ADMIN_BASE_PATH || tenant.basePath,
  };
});
