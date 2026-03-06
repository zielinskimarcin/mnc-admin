import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/mnc-admin/", // 👈 NAZWA REPO Z SLASHAMI
});